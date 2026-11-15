export const formatPKR = (n, { sign = false } = {}) => {
  const v = Math.round(Number(n) || 0);
  const s = `Rs. ${Math.abs(v).toLocaleString('en-US')}`;
  return v < 0 ? `-${s}` : sign && v > 0 ? `+${s}` : s;
};
export const formatNum = (n) => Math.round(Number(n) || 0).toLocaleString('en-US');
export const dash = (n) => (Number(n) ? formatNum(n) : '-');
