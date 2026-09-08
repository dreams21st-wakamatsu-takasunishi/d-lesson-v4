import { createClient } from '@supabase/supabase-js';

export async function approveWordWithTeacher({ email, password, userDataId, stageId, page }) {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('Supabaseの接続設定がありません。');
    const table = import.meta.env.VITE_SUPABASE_TABLE || (import.meta.env.VITE_SUPABASE_USE_TEST_TABLE === 'true' ? 'test_user_data' : 'user_data');
    // A memory-only client must never replace the child's session or persist teacher credentials.
    const teacher = createClient(url, key, {
        auth: { storageKey: 'd-lesson-word-approval', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(30000) }) }
    });
    try {
        const { error: authError } = await teacher.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw new Error(authError.status === 429
            ? '確認の回数が多いため、少し時間をおいてください。'
            : 'メールアドレスまたはパスワードを確認してください。');
        const { data, error } = await teacher.functions.invoke('approve-word-stage', { body: { userDataId, stageId, page, table } });
        if (error) {
            let message = '承認結果を確認できませんでした。もう一度確認してもコインは重複しません。';
            try { message = (await error.context.json()).error || message; } catch { /* Network errors have no JSON response. */ }
            const failure = new Error(message);
            failure.requiresReload = !error.context?.status || error.context.status >= 500;
            throw failure;
        }
        if (data?.userDataId !== userDataId || data?.stageId !== stageId || !data?.data) {
            const failure = new Error('承認結果を確認できませんでした。もう一度確認してください。');
            failure.requiresReload = true;
            throw failure;
        }
        return data;
    } finally {
        password = '';
        // The default global scope would also sign the teacher out on other classroom devices.
        try { await teacher.auth.signOut({ scope: 'local' }); } catch { /* The client and its in-memory session are discarded. */ }
    }
}
