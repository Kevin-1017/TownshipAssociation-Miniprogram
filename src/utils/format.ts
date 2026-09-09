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

/** 距今多久:<1h 显示分钟,<24h 显示小时,<30天显示天,否则显示日期 */
export const formatRelative = (iso: string): string => {
  if (!iso) return '';
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return iso;
  const diff = Date.now() - d;
  if (diff < 0) return formatMonthDay(iso);
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} 小时前`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day} 天前`;
  return formatDate(iso);
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
