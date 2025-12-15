import Decimal from '../../infrastructure/decimal.mjs';
import Integer from '../../infrastructure/Integer.js';
import Money from '../../infrastructure/Money.js';
import Percentage from '../../infrastructure/Percentage.js';

export class Model_Report_Advertising {
    #广告费用_退款前;
    #广告费用_退款后;
    #广告费用_售前损失;
    #广告费用_售中损失;
    #广告费用_售后损失;

    constructor() {
        this.#广告费用_退款前 = new Money(0, 4);
        this.#广告费用_退款后 = new Money(0, 4);
        this.#广告费用_售前损失 = new Money(0, 4);
        this.#广告费用_售中损失 = new Money(0, 4);
        this.#广告费用_售后损失 = new Money(0, 4);

    }

    get 广告费用_退款前() { return this.#广告费用_退款前; }
    get 广告费用_退款后() { return this.#广告费用_退款后; }
    get 广告费用_售前损失() { return this.#广告费用_售前损失; }
    get 广告费用_售中损失() { return this.#广告费用_售中损失; }
    get 广告费用_售后损失() { return this.#广告费用_售后损失; }
    get 广告费用_总退款损失() { return this.#广告费用_售前损失.plus(this.#广告费用_售中损失).plus(this.#广告费用_售后损失); }
    // get 广告费用_退款校验() { return this.广告费用_总退款损失.equals(this.#广告费用_退款前.minus(this.#广告费用_退款后)); }
    get 广告费用_有效成本() { return this.#广告费用_退款后.plus(this.广告费用_总退款损失); }


    set 广告费用_退款前(value) { this.#广告费用_退款前 = value; }
    set 广告费用_退款后(value) { this.#广告费用_退款后 = value; }
    set 广告费用_售前损失(value) { this.#广告费用_售前损失 = value; }
    set 广告费用_售中损失(value) { this.#广告费用_售中损失 = value; }
    set 广告费用_售后损失(value) { this.#广告费用_售后损失 = value; }


}
