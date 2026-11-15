"""Integration tests against a disposable PostgreSQL database with pgvector.

Set AUTH_TEST_DATABASE_URL to a database named vetra_auth_test. Tests never use
the application's configured database. Image embeddings are stubbed; the actual
pgvector nearest-neighbor query and ownership checks run against PostgreSQL.
"""

import os
import secrets
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

import bcrypt
import jwt
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

TEST_URL = os.environ.get("AUTH_TEST_DATABASE_URL", "")
if not TEST_URL or make_url(TEST_URL).database != "vetra_auth_test":
    raise RuntimeError(
        "Set AUTH_TEST_DATABASE_URL to a disposable vetra_auth_test database."
    )

os.environ["DATABASE_URL"] = TEST_URL
os.environ["JWT_SECRET_KEY"] = secrets.token_urlsafe(48)

from app.database.connection import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.models import Face, User  # noqa: E402
from app.services.auth_service import (  # noqa: E402
    TOKEN_AUDIENCE,
    TOKEN_ISSUER,
    get_jwt_secret,
)
from app.services.facial_service import facial_service  # noqa: E402


class AuthOwnershipTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        api_path = Path(__file__).resolve().parents[1]
        config = Config(str(api_path / "alembic.ini"))
        config.set_main_option("script_location", str(api_path / "alembic"))
        command.upgrade(config, "fd51e5804432")
        cls.engine = create_engine(TEST_URL)
        cls.legacy_id = uuid4()
        with cls.engine.begin() as connection:
            connection.execute(
                text(
                    "INSERT INTO faces (id, name, embedding) "
                    "VALUES (:id, :name, :embedding)"
                ),
                {
                    "id": cls.legacy_id,
                    "name": "Legacy face",
                    "embedding": str([1.0] * 512),
                },
            )
        command.upgrade(config, "head")

    def setUp(self):
        self.connection = self.engine.connect()
        self.transaction = self.connection.begin()
        self.db = Session(
            bind=self.connection, join_transaction_mode="create_savepoint"
        )

        def override_db():
            yield self.db

        app.dependency_overrides[get_db] = override_db
        self.client = TestClient(app)
        self.owner = self.create_account("owner@example.com")
        self.other = self.create_account("other@example.com")

    def tearDown(self):
        self.client.close()
        app.dependency_overrides.clear()
        self.db.close()
        self.transaction.rollback()
        self.connection.close()

    @classmethod
    def tearDownClass(cls):
        cls.engine.dispose()

    def create_account(self, email):
        response = self.client.post(
            "/api/auth/register",
            json={
                "name": "  Test User  ",
                "email": email,
                "password": "password-123",
            },
        )
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def headers(self, account):
        return {
            "Authorization": f"Bearer {account['access_token']}",
            "X-User-Id": account["user"]["id"],
        }

    def register_face(self, account):
        with patch.object(facial_service, "_process_image", return_value=[1.0] * 512):
            response = self.client.post(
                "/api/faces/register",
                headers=self.headers(account),
                data={"name": "Registered Face"},
                files={"image": ("face.jpg", b"stub image", "image/jpeg")},
            )
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def test_registration_hash_login_and_me(self):
        from uuid import UUID

        user = self.db.get(User, UUID(self.owner["user"]["id"]))
        self.assertNotEqual(user.password_hash, "password-123")
        self.assertTrue(bcrypt.checkpw(b"password-123", user.password_hash.encode()))
        self.assertNotIn("password_hash", self.owner["user"])
        self.assertEqual(self.owner["user"]["name"], "Test User")
        response = self.client.post(
            "/api/auth/login",
            json={
                "email": " OWNER@example.com ",
                "password": "password-123",
            },
        )
        self.assertEqual(response.status_code, 200)
        response = self.client.get("/api/auth/me", headers=self.headers(self.owner))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], self.owner["user"]["id"])
        self.assertEqual(response.headers["cache-control"], "no-store")

    def test_duplicate_email_and_invalid_login(self):
        response = self.client.post(
            "/api/auth/register",
            json={
                "name": "Duplicate",
                "email": "OWNER@EXAMPLE.COM",
                "password": "password-123",
            },
        )
        self.assertEqual(response.status_code, 409)
        messages = []
        for email, password in [
            ("missing@example.com", "password-123"),
            ("owner@example.com", "wrong-pass"),
        ]:
            response = self.client.post(
                "/api/auth/login", json={"email": email, "password": password}
            )
            self.assertEqual(response.status_code, 401)
            messages.append(response.json())
        self.assertEqual(messages[0], messages[1])

    def test_input_validation_does_not_echo_password(self):
        for overrides in [
            {"name": " "},
            {"email": "invalid"},
            {"password": "short"},
            {"password": "é" * 37},
            {"password": " " * 8},
            {"name": "x" * 151},
        ]:
            payload = {
                "name": "Test User",
                "email": "new@example.com",
                "password": "password-123",
                **overrides,
            }
            response = self.client.post("/api/auth/register", json=payload)
            self.assertEqual(response.status_code, 422, response.text)
            self.assertNotIn('"input"', response.text)

    def test_listing_and_deletion_are_scoped_and_legacy_faces_hidden(self):
        face = self.register_face(self.owner)
        self.assertEqual(face["user_id"], self.owner["user"]["id"])
        response = self.client.get("/api/faces", headers=self.headers(self.owner))
        self.assertEqual([item["id"] for item in response.json()], [face["id"]])
        response = self.client.get("/api/faces", headers=self.headers(self.other))
        self.assertEqual(response.json(), [])
        response = self.client.delete(
            f"/api/faces/{face['id']}", headers=self.headers(self.other)
        )
        self.assertEqual(response.status_code, 404)
        legacy = self.db.scalar(select(Face).where(Face.id == self.legacy_id))
        self.assertIsNone(legacy.user_id)
        response = self.client.delete(
            f"/api/faces/{face['id']}", headers=self.headers(self.owner)
        )
        self.assertEqual(response.status_code, 204)

    def test_recognition_only_searches_the_authenticated_account(self):
        face = self.register_face(self.owner)
        with patch.object(facial_service, "_process_image", return_value=[1.0] * 512):
            for account, matched in [(self.owner, True), (self.other, False)]:
                response = self.client.post(
                    "/api/faces/recognize",
                    headers=self.headers(account),
                    files={"image": ("face.jpg", b"stub image", "image/jpeg")},
                )
                self.assertEqual(response.status_code, 200, response.text)
                self.assertEqual(response.json()["matched"], matched)
                self.assertEqual(response.json()["id"], face["id"] if matched else None)

    def test_spoofed_owner_header_is_rejected_on_every_face_route(self):
        headers = {**self.headers(self.other), "X-User-Id": self.owner["user"]["id"]}
        requests = [
            ("GET", "/api/faces", {}),
            ("DELETE", f"/api/faces/{uuid4()}", {}),
            (
                "POST",
                "/api/faces/register",
                {
                    "data": {"name": "Face"},
                    "files": {"image": ("face.jpg", b"stub", "image/jpeg")},
                },
            ),
            (
                "POST",
                "/api/faces/recognize",
                {"files": {"image": ("face.jpg", b"stub", "image/jpeg")}},
            ),
        ]
        for method, url, kwargs in requests:
            response = self.client.request(method, url, headers=headers, **kwargs)
            self.assertEqual(response.status_code, 403, response.text)

    def test_missing_tampered_and_expired_tokens_are_rejected(self):
        self.assertEqual(self.client.get("/api/faces").status_code, 401)
        for token in ["not-a-token", self.owner["access_token"] + "tampered"]:
            response = self.client.get(
                "/api/faces",
                headers={
                    **self.headers(self.owner),
                    "Authorization": f"Bearer {token}",
                },
            )
            self.assertEqual(response.status_code, 401)
        now = datetime.now(timezone.utc)
        for secret, expires in [
            (get_jwt_secret(), now - timedelta(seconds=1)),
            (secrets.token_urlsafe(48), now + timedelta(hours=1)),
        ]:
            token = jwt.encode(
                {
                    "sub": self.owner["user"]["id"],
                    "iat": now - timedelta(hours=1),
                    "exp": expires,
                    "iss": TOKEN_ISSUER,
                    "aud": TOKEN_AUDIENCE,
                },
                secret,
                algorithm="HS256",
            )
            response = self.client.get(
                "/api/faces",
                headers={
                    **self.headers(self.owner),
                    "Authorization": f"Bearer {token}",
                },
            )
            self.assertEqual(response.status_code, 401)

    def test_deleted_user_cannot_use_a_previously_issued_token(self):
        from uuid import UUID

        self.db.delete(self.db.get(User, UUID(self.owner["user"]["id"])))
        self.db.commit()
        response = self.client.get("/api/faces", headers=self.headers(self.owner))
        self.assertEqual(response.status_code, 401)

    def test_invalid_owner_id_and_pagination(self):
        headers = self.headers(self.owner)
        self.assertEqual(
            self.client.get(
                "/api/faces", headers={**headers, "X-User-Id": "invalid"}
            ).status_code,
            422,
        )
        self.assertEqual(
            self.client.get(
                "/api/faces", headers={"Authorization": headers["Authorization"]}
            ).status_code,
            422,
        )
        for query in ["skip=-1", "limit=0", "limit=101"]:
            self.assertEqual(
                self.client.get(f"/api/faces?{query}", headers=headers).status_code, 422
            )


if __name__ == "__main__":
    unittest.main()
