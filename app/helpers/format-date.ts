import { helper } from '@ember/component/helper';

export default helper(function formatDate([date]: [Date]): string {
  return Intl.DateTimeFormat().format(date);
});
