/**
 * 展示层格式化工具。
 *
 * 注意:后端一律返回 ISO 8601 字符串(如 '2026-09-06T14:30:00+08:00'),
 * 不要在接口里返回已经格式化好的中文日期 —— 那样前端无法做本地化与排序。
 */

const pad = (n: number) => String(n).padStart(2, '0')

/** '2026-09-06T14:30:00+08:00' → '2026-09-06 14:30:00' */
export const formatFull = (iso: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** '2026-09-06T14:30:00+08:00' → '2026-09-06' */
export const formatDate = (iso: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** → '09-06 14:30' */
export const formatMonthDay = (iso: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 届别:2018 → '2018 届' */
export const formatGrade = (year: number): string => {
  return year ? `${year} 届` : '—';
}

/** 金额:'50000' → '¥5万', '3000' → '¥3000' */
export const formatAmount = (yuan: number): string => {
  if (yuan >= 10000) return `¥${(yuan / 10000).toFixed(yuan % 10000 === 0 ? 0 : 1)}万`;
  return `¥${yuan}`;
}
