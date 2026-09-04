export const timeAgo = (date: number) => {
  const seconds = Math.floor((Date.now() - date) / 1000);
  const years = Math.floor(seconds / 31_536_000);
  if (years >= 1) return `${years}y ago`;

  const months = Math.floor(seconds / 2_592_000);
  if (months >= 1) return `${months}mo ago`;

  const days = Math.floor(seconds / 86_400);
  if (days >= 1) return `${days}d ago`;

  const hours = Math.floor(seconds / 3600);
  if (hours >= 1) return `${hours}h ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes >= 1) return `${minutes}m ago`;
  return 'just now';
};
