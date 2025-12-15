
/**
 * Entity 日期时间工具类
 * @class DateTimeUtils
 */
export class DateTimeUtils {

    // 格式化日期为yyyy-mm-dd hh:mm:ss格式
    static to_yyyymmdd_hhmmss(date) {
        try {
            date = new Date(date);
        } catch (error) {
            throw new Error('无效的日期格式');
        }
        // 获取本地时间的年、月、日、时、分、秒
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0'); // 月份从0开始，需+1
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        // 拼接成本地时间格式：YYYY-MM-DD HH:mm:ss
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }

}