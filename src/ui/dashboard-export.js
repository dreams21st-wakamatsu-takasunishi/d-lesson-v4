export function exportDashboardCSV() {
    const isVision = document.getElementById('dash-vision').style.display === 'block';
    let csv = '\uFEFF';
    let thead = document.querySelector(isVision ? '#dash-vision-thead tr' : '#dash-basic thead tr');
    let tbody = document.querySelector(isVision ? '#dash-vision-tbody' : '#dash-tbody');

    if (!thead || !tbody) {
        alert('出力するデータがありません');
        return;
    }

    let headers = [];
    thead.querySelectorAll('th').forEach(th => headers.push(`"${th.innerText.replace(/"/g, '""')}"`));
    csv += headers.join(',') + '\n';

    tbody.querySelectorAll('tr').forEach(tr => {
        let row = [];
        tr.querySelectorAll('td').forEach(td => {
            let text = td.innerText.replace(/\r?\n/g, ' ').trim();
            row.push(`"${text.replace(/"/g, '""')}"`);
        });
        csv += row.join(',') + '\n';
    });

    let blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    let link = document.createElement('a');
    let dateStr = new Date().toISOString().slice(0, 10);
    let fileName = isVision ? `ビジョンタイム_${dateStr}.csv` : `基本進捗_${dateStr}.csv`;
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
}
