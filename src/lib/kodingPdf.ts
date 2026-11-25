import type { Item } from './types';

export interface KodingPdfGroup {
  label: string;
  items: Item[];
}

function safeFileName(s: string): string {
  return s.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'export';
}

const isUrl = (s: string | null | undefined) => /^https?:\/\//i.test((s ?? '').trim());

/**
 * Ekspor List Koding ke PDF (A4 landscape). Setiap kelompok mulai di
 * halaman baru. Link file kemasan bisa diklik; item tanpa link ditandai merah.
 * jsPDF dimuat saat dibutuhkan agar bundle awal tetap kecil.
 */
export async function exportKodingPdf(projectName: string, groups: KodingPdfGroup[]): Promise<void> {
  if (groups.length === 0) return;
  const { doc, fileName } = await buildKodingPdf(projectName, groups);
  doc.save(fileName);
}

let printFrame: HTMLIFrameElement | null = null;

/**
 * Cetak List Koding dengan tata letak yang sama dengan PDF: PDF dibuat di
 * memori, dimuat ke iframe tersembunyi, lalu dialog cetak browser dibuka.
 */
export async function printKodingPdf(projectName: string, groups: KodingPdfGroup[]): Promise<void> {
  if (groups.length === 0) return;
  const { doc } = await buildKodingPdf(projectName, groups);
  const url = URL.createObjectURL(doc.output('blob'));

  if (printFrame) {
    URL.revokeObjectURL(printFrame.src);
    printFrame.remove();
  }
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  printFrame = frame;

  await new Promise<void>((resolve, reject) => {
    frame.onload = () => {
      // beri waktu penampil PDF bawaan browser selesai merender
      setTimeout(() => {
        try {
          frame.contentWindow!.focus();
          frame.contentWindow!.print();
          resolve();
        } catch {
          // cadangan: buka di tab baru, pengguna cetak dari sana
          window.open(url, '_blank') ? resolve() : reject(new Error('Browser memblokir jendela cetak. Izinkan pop-up untuk situs ini.'));
        }
      }, 300);
    };
    frame.src = url;
    document.body.appendChild(frame);
  });
}

async function buildKodingPdf(projectName: string, groups: KodingPdfGroup[]) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const dicetak = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short' }).format(new Date());

  groups.forEach((g, gi) => {
    if (gi > 0) doc.addPage();

    // judul
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text(`LIST KODING — ${projectName}`, margin, margin + 4);

    doc.setFontSize(13);
    doc.setTextColor(3, 105, 161);
    doc.text(g.label, margin, margin + 12);

    const missing = g.items.filter((i) => !(i.file_kemasan ?? '').trim()).length;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);
    const info = `${g.items.length} item${missing ? ` · ${missing} belum ada link file` : ''} · Dicetak ${dicetak}`;
    doc.text(info, margin, margin + 18);

    autoTable(doc, {
      startY: margin + 22,
      margin: { left: margin, right: margin, bottom: 16 },
      head: [['No', 'Brand', 'Nama Produk', 'Gramasi', 'No Batch', 'Sediaan', 'Link File Kemasan']],
      body: g.items.map((it, idx) => [
        String(idx + 1),
        it.brand,
        it.nama_produk,
        it.gramasi ?? '',
        it.no_batch ?? '',
        it.sediaan ?? '',
        (it.file_kemasan ?? '').trim() || 'BELUM ADA LINK FILE',
      ]),
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.2, textColor: [15, 23, 42], lineColor: [203, 213, 225], lineWidth: 0.2, valign: 'middle', overflow: 'linebreak' },
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
        2: { cellWidth: 72, fontStyle: 'bold' },
        3: { cellWidth: 22 },
        4: { cellWidth: 28 },
        5: { cellWidth: 26 },
        6: { cellWidth: 'auto', fontSize: 8 },
      },
      didParseCell: (data) => {
        if (data.section !== 'body' || data.column.index !== 6) return;
        const it = g.items[data.row.index];
        if (!(it.file_kemasan ?? '').trim()) {
          data.cell.styles.textColor = [190, 18, 60];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [255, 241, 242];
        } else if (isUrl(it.file_kemasan)) {
          data.cell.styles.textColor = [3, 105, 161];
        }
      },
      didDrawCell: (data) => {
        if (data.section !== 'body' || data.column.index !== 6) return;
        const url = g.items[data.row.index].file_kemasan;
        if (isUrl(url)) doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: url!.trim() });
      },
    });
  });

  // nomor halaman
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`${projectName} · List Koding`, margin, pageH - 8);
    doc.text(`Halaman ${p} dari ${total}`, pageW - margin, pageH - 8, { align: 'right' });
  }

  const suffix = groups.length === 1 ? groups[0].label : 'SEMUA KELOMPOK';
  return { doc, fileName: `${safeFileName(`LIST KODING ${projectName} - ${suffix}`)}.pdf` };
}
