import Decimal from '../../infrastructure/decimal.mjs';
import Integer from '../../infrastructure/Integer.js';
import Money from '../../infrastructure/Money.js';
import Percentage from '../../infrastructure/Percentage.js';

/**
 * 扩展报告
 */
export class Model_Report_Ext {

    #总成本;
    #利润;
    #利润率;
    #资本回报率;
    #推广回报率;
    #因退款造成的成本损失; // 退款订单仍需要支出一部分成本
    #因退款造成的利润损失; // 理论上，如果没有退款，应该会有更多的利润
    constructor() {
        this.#总成本 = new Money(0, 4);
        this.#利润 = new Money(0, 4);
        this.#利润率 = new Percentage(0, 4);
        this.#资本回报率 = new Percentage(0, 4);
        this.#推广回报率 = new Percentage(0, 4);
    }
    get 总成本() {return this.#总成本;}
    get 利润() {return this.#利润;}
    get 利润率() {return this.#利润率;}
    get 资本回报率() {return this.#资本回报率;}
    get 推广回报率() {return this.#推广回报率;}
    get 因退款造成的成本损失() {return this.#因退款造成的成本损失;}
    get 因退款造成的利润损失() {return this.#因退款造成的利润损失;}

    set 总成本(value) {this.#总成本 = value;}
    set 利润(value) {this.#利润 = value;}
    set 利润率(value) {this.#利润率 = value;}
    set 资本回报率(value) {this.#资本回报率 = value;}
    set 推广回报率(value) {this.#推广回报率 = value;}
    set 因退款造成的成本损失(value) {this.#因退款造成的成本损失 = value;}
    set 因退款造成的利润损失(value) {this.#因退款造成的利润损失 = value;}

}
