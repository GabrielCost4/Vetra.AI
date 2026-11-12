const CONNECTION_MESSAGE =
  'Não foi possível conectar à API. Verifique se ela está em execução e tente novamente.';

interface ValidationIssue {
  msg?: unknown;
}

function readDetail(error: unknown): unknown {
  if (typeof error !== 'object' || error === null) return undefined;
  const payload = (error as { error?: unknown }).error;
  if (typeof payload !== 'object' || payload === null) return undefined;
  return (payload as { detail?: unknown }).detail;
}

function messageFromDetail(detail: unknown): string | null {
  if (typeof detail === 'string') {
    const text = detail.trim();
    return text || null;
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((issue): string => {
        if (typeof issue === 'string') return issue.trim();
        if (typeof issue === 'object' && issue !== null) {
          const message = (issue as ValidationIssue).msg;
          return typeof message === 'string' ? message.trim() : '';
        }
        return '';
      })
      .filter((message) => message.length > 0);
    return messages.length > 0 ? messages.join(' ') : null;
  }

  return null;
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  const detail = messageFromDetail(readDetail(error));
  if (detail) return detail;

  const status =
    typeof error === 'object' && error !== null
      ? (error as { status?: unknown }).status
      : undefined;
  if (status === 0) return CONNECTION_MESSAGE;

  return fallback;
}
