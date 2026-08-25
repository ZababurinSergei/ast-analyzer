import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { useFetch } from '@/composables/common/useFetch.ts';

describe('useFetch', () => {
    const baseUrl = 'http://example.com';

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('send формирует URL, headers и body, и возвращает JSON', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue({ data: 123 }),
        });
        vi.stubGlobal('fetch', fetchMock);

        const { loading, error, send } = useFetch(baseUrl);

        const promise = send('endpoint', { a: 1 }, { Authorization: 'Bearer t' });

        expect(loading.value).toBe(true);
        expect(error.value).toBeNull();

        const result = await promise;

        expect(result).toEqual({ data: 123 });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/endpoint`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                Authorization: 'Bearer t',
            },
            body: JSON.stringify({ a: 1 }),
        });
        expect(loading.value).toBe(false);
        expect(error.value).toBeNull();
    });

    it('send возвращает { success: true } при 204', async () => {
        const jsonMock = vi.fn();
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 204,
            json: jsonMock,
        });
        vi.stubGlobal('fetch', fetchMock);

        const { send } = useFetch(baseUrl);

        const result = await send('no-content');

        expect(result).toEqual({ success: true });
        expect(jsonMock).not.toHaveBeenCalled();
    });

    it('send выставляет error и пробрасывает ошибку при !ok', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
            json: vi.fn(),
        });
        vi.stubGlobal('fetch', fetchMock);

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const { loading, error, send } = useFetch(baseUrl);

        await expect(send('boom')).rejects.toThrow('HTTP 500');
        expect(loading.value).toBe(false);
        expect(error.value).toBe('HTTP 500');
        expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('send выставляет error из не-Error значения и пробрасывает его', async () => {
        const fetchMock = vi.fn().mockRejectedValue('fail');
        vi.stubGlobal('fetch', fetchMock);

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const { loading, error, send } = useFetch(baseUrl);

        await expect(send('boom')).rejects.toBe('fail');
        expect(loading.value).toBe(false);
        expect(error.value).toBe('fail');
        expect(consoleErrorSpy).toHaveBeenCalled();
    });
});
