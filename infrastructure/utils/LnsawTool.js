/**
 * 业务利润模拟沙盘工具类
 * 提供数字处理和UI交互功能
 */
class LnsawTool {
  /**
   * 数字处理工具集
   */
  static NumberTools = {
    /**
     * 将元转换为分（整数）
     * @param {number} yuan - 元金额
     * @returns {number} 分金额（整数）
     */
    YuanToCents(yuan) {
      return Number.isNaN(yuan) ? 0 : Math.round(yuan * 100);
    },

    /**
     * 将元转换为毫（整数）
     * @param {number} yuan - 元金额
     * @returns {number} 毫金额（整数）
     */
    YuanToMills(yuan) {
      return Number.isNaN(yuan) ? 0 : Math.round(yuan * 10000);
    },

    /**
     * 将分转换为元
     * @param {number} cents - 分金额
     * @returns {number} 元金额
     */
    CentstoYuan(cents) {
      return Number.isNaN(cents) ? 0 : cents / 100;
    },

    /**
     * 将毫转换为元
     * @param {number} mills - 毫金额
     * @returns {number} 元金额
     */
    MillstoYuan(mills) {
      return Number.isNaN(mills) ? 0 : mills / 10000;
    },

    /**
     * 安全四舍五入到指定小数位
     * @param {number} num - 要四舍五入的数字
     * @param {number} decimals - 小数位数，默认为2
     * @returns {number} 四舍五入后的数字
     */
    round(num, decimals = 2) {
      if (Number.isNaN(num)) return 0;
      const factor = Math.pow(10, decimals);
      return Math.round(num * factor) / factor;
    },

    /**
     * 将数字格式化为指定小数位的字符串
     * @param {number} num - 要格式化的数字
     * @param {number} decimals - 小数位数，默认为2
     * @returns {string} 格式化后的字符串
     */
    toFixed(num, decimals = 2) {
      if (Number.isNaN(num)) return `0.${'0'.repeat(decimals)}`;
      // 先调用round函数进行四舍五入，再补全位数
      const roundedNum = this.round(num, decimals);
      // 将数字转换为字符串并补全小数位
      return Number(roundedNum).toFixed(decimals);
    },

    /**
     * 格式化数字为货币形式（添加千分符）
     * @param {number} num - 要格式化的数字
     * @param {number} decimals - 小数位数，默认为2
     * @returns {string} 格式化后的货币字符串
     */
    toMoney(num, decimals = 2) {
      if (typeof num !== 'number' || Number.isNaN(num)) return String(num);

      // 先四舍五入到指定位数
      const factor = Math.pow(10, decimals);
      const fixedNum = Math.round(num * factor) / factor;

      // 拆分成整数部分和小数部分
      const parts = fixedNum.toString().split('.');
      let integerPart = parts[0];
      let decimalPart = parts[1] || '';

      // 添加千分符
      integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

      // 如果小数位数为0，直接返回整数部分
      if (decimals === 0) {
        return integerPart;
      }

      // 补全小数位数
      if (decimalPart.length < decimals) {
        decimalPart = decimalPart.padEnd(decimals, '0');
      }

      return `${integerPart}.${decimalPart}`;
    }
  };

  /**
   * 显示toast消息提示
   * @param {string} message - 消息内容
   * @param {string} type - 消息类型：success, error, warning, info
   * @param {number} delay - 显示时长，单位毫秒，默认2000ms
   */
  static showToast(message, type = 'info', delay = 2000) {
    // 确保toast容器存在
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3 z-50';
      document.body.appendChild(toastContainer);
    }

    // 创建toast元素
    const toastEl = document.createElement('div');
    toastEl.className = `toast align-items-center text-bg-${type} border-0`;
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'assertive');
    toastEl.setAttribute('aria-atomic', 'true');

    toastEl.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">
          ${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>
    `;

    // 添加到容器
    toastContainer.appendChild(toastEl);

    // 初始化并显示toast
    const toast = new bootstrap.Toast(toastEl, {
      autohide: true,
      delay: delay
    });
    toast.show();

    // 当toast隐藏后移除元素
    toastEl.addEventListener('hidden.bs.toast', () => {
      toastContainer.removeChild(toastEl);
    });
  }

  /**
   * 初始化工具类
   */
  static async initialize() {
    // 初始化逻辑，如有需要可添加
    console.log('LnsawTool initialized successfully');
  }
}

// 自动初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => LnsawTool.initialize());
} else {
  LnsawTool.initialize();
}

// 导出类，以便其他模块使用
export default LnsawTool;