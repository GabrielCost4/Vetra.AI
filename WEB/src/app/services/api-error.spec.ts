import { apiErrorMessage } from './api-error';

describe('apiErrorMessage', () => {
  const fallback = 'Não foi possível concluir a operação.';

  it('returns a string detail from the API', () => {
    expect(apiErrorMessage({ error: { detail: 'Rosto não detectado.' } }, fallback)).toBe(
      'Rosto não detectado.',
    );
  });

  it('joins validation messages returned as a list', () => {
    const error = {
      error: {
        detail: [
          { loc: ['body', 'name'], msg: 'String should have at most 150 characters' },
          { loc: ['query', 'limit'], msg: 'Input should be less than or equal to 200' },
        ],
      },
    };
    expect(apiErrorMessage(error, fallback)).toBe(
      'String should have at most 150 characters Input should be less than or equal to 200',
    );
  });

  it('falls back when the API sends no detail', () => {
    expect(apiErrorMessage({ error: {} }, fallback)).toBe(fallback);
    expect(apiErrorMessage(null, fallback)).toBe(fallback);
  });

  it('explains connection failures', () => {
    expect(apiErrorMessage({ status: 0 }, fallback)).toContain('Não foi possível conectar à API');
  });
});
