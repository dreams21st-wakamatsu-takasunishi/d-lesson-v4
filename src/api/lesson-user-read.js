/** The explicit student filter narrows a read; server-side RLS remains authoritative. */
export function readLessonUserRows(client, table, studentId, settingsId) {
    const query = client.from(table).select('id,data');
    return studentId ? query.in('id', [studentId, settingsId]) : query;
}
