import Decimal from '../../infrastructure/decimal.mjs';
import Integer from '../../infrastructure/Integer.js';
import Money from '../../infrastructure/Money.js';
import Percentage from '../../infrastructure/Percentage.js';

export class Model_Report_GiftCost {
    #赠品成本_退款前;
    #赠品成本_退款后;
    #赠品成本_售前损失;
    #赠品成本_售中损失;
    #赠品成本_售后损失;
    #赠品成本_额外缴税;

    #明细;

    constructor() {
        this.#赠品成本_退款前 = new Money(0, 4);
        this.#赠品成本_退款后 = new Money(0, 4);
        this.#赠品成本_售前损失 = new Money(0, 4);
        this.#赠品成本_售中损失 = new Money(0, 4);
        this.#赠品成本_售后损失 = new Money(0, 4);
        this.#赠品成本_额外缴税 = new Money(0, 4);

        this.#明细 = [];
    }

    get 赠品成本_退款前() { return this.#赠品成本_退款前; }
    get 赠品成本_退款后() { return this.#赠品成本_退款后; }
    get 赠品成本_售前损失() { return this.#赠品成本_售前损失; }
    get 赠品成本_售中损失() { return this.#赠品成本_售中损失; }
    get 赠品成本_售后损失() { return this.#赠品成本_售后损失; }
    get 赠品成本_总退款损失() { return this.#赠品成本_售前损失.plus(this.#赠品成本_售中损失).plus(this.#赠品成本_售后损失); }
    get 赠品成本_额外缴税() { return this.#赠品成本_额外缴税; }
    get 赠品成本_有效成本() { return this.#赠品成本_退款后.plus(this.赠品成本_总退款损失).plus(this.#赠品成本_额外缴税); }

    get 明细() { return this.#明细; }

    set 赠品成本_退款前(value) { this.#赠品成本_退款前 = value; }
    set 赠品成本_退款后(value) { this.#赠品成本_退款后 = value; }
    set 赠品成本_售前损失(value) { this.#赠品成本_售前损失 = value; }
    set 赠品成本_售中损失(value) { this.#赠品成本_售中损失 = value; }
    set 赠品成本_售后损失(value) { this.#赠品成本_售后损失 = value; }
    set 赠品成本_额外缴税(value) { this.#赠品成本_额外缴税 = value; }

    checkAll() {
        const errors = [];
        let 明细成本累计 = new Money(0, 10);
        for (const item of this.#明细) {
            明细成本累计 = 明细成本累计.plus(item.赠品成本_退款前);
        }
        if (!明细成本累计.equals(this.#赠品成本_退款前)) {
            errors.push(`赠品成本_退款前校验失败，明细累计${明细成本累计.toString()}，总计${this.#赠品成本_退款前.toString()}`);
        } else {
            errors.push(`赠品成本_退款前校验通过，明细累计${明细成本累计.toString()}，总计${this.#赠品成本_退款前.toString()}`);
        }

        return errors;
    }

}

export class Model_Report_GiftCost_Item {
    #赠品名称;
    #赠品成本_含税;
    #赠品成本_不含税;
    #进项税率;

    #赠品数量_退款前;
    #赠品数量_退款后;
    #赠品数量_售前损失;
    #赠品数量_售中损失;
    #赠品数量_售后损失;

    #赠品成本_退款前;
    #赠品成本_退款后;
    #赠品成本_售前损失;
    #赠品成本_售中损失;
    #赠品成本_售后损失;
    #赠品成本_额外缴税;

    constructor() {
        this.#赠品名称 = '';
        this.#进项税率 = new Percentage(0, 4);

        this.#赠品数量_退款前 = new Integer(0);
        this.#赠品数量_退款后 = new Integer(0);
        this.#赠品数量_售前损失 = new Integer(0);
        this.#赠品数量_售中损失 = new Integer(0);
        this.#赠品数量_售后损失 = new Integer(0);

        this.#赠品成本_退款前 = new Money(0, 4);
        this.#赠品成本_退款后 = new Money(0, 4);
        this.#赠品成本_售前损失 = new Money(0, 4);
        this.#赠品成本_售中损失 = new Money(0, 4);
        this.#赠品成本_售后损失 = new Money(0, 4);
        this.#赠品成本_额外缴税 = new Money(0, 4);
    }
    get 赠品名称() { return this.#赠品名称; }
    get 赠品成本_含税() { return this.#赠品成本_含税; }
    get 赠品成本_不含税() { return this.#赠品成本_不含税; }
    get 进项税率() { return this.#进项税率; }

    get 赠品数量_退款前() { return this.#赠品数量_退款前; }
    get 赠品数量_退款后() { return this.#赠品数量_退款后; }
    get 赠品数量_售前损失() { return this.#赠品数量_售前损失; }
    get 赠品数量_售中损失() { return this.#赠品数量_售中损失; }
    get 赠品数量_售后损失() { return this.#赠品数量_售后损失; }
    get 赠品数量_总退款损失() { return this.#赠品数量_售前损失.plus(this.#赠品数量_售中损失).plus(this.#赠品数量_售后损失); }
    // - 实际上，不存在有效数量。一般来说退款后的数量就是真实的数量，至于退款的数量...数量和成本是有区别的。
    get 赠品数量_有效数量() { return this.#赠品数量_退款后.plus(this.赠品数量_总退款损失); }

    get 赠品成本_退款前() { return this.#赠品成本_退款前; }
    get 赠品成本_退款后() { return this.#赠品成本_退款后; }
    get 赠品成本_售前损失() { return this.#赠品成本_售前损失; }
    get 赠品成本_售中损失() { return this.#赠品成本_售中损失; }
    get 赠品成本_售后损失() { return this.#赠品成本_售后损失; }
    get 赠品成本_额外缴税() { return this.#赠品成本_额外缴税; }
    get 赠品成本_总退款损失() { return this.#赠品成本_售前损失.plus(this.#赠品成本_售中损失).plus(this.#赠品成本_售后损失); }
    get 赠品成本_有效成本() { return this.#赠品成本_退款后.plus(this.#赠品成本_额外缴税).plus(this.赠品成本_总退款损失); }

    set 赠品名称(value) { this.#赠品名称 = value; }
    set 赠品成本_含税(value) { this.#赠品成本_含税 = value; }
    set 赠品成本_不含税(value) { this.#赠品成本_不含税 = value; }
    set 进项税率(value) { this.#进项税率 = value; }

    set 赠品数量_退款前(value) { this.#赠品数量_退款前 = value; }
    set 赠品数量_退款后(value) { this.#赠品数量_退款后 = value; }
    set 赠品数量_售前损失(value) { this.#赠品数量_售前损失 = value; }
    set 赠品数量_售中损失(value) { this.#赠品数量_售中损失 = value; }
    set 赠品数量_售后损失(value) { this.#赠品数量_售后损失 = value; }

    set 赠品成本_退款前(value) { this.#赠品成本_退款前 = value; }
    set 赠品成本_退款后(value) { this.#赠品成本_退款后 = value; }
    set 赠品成本_售前损失(value) { this.#赠品成本_售前损失 = value; }
    set 赠品成本_售中损失(value) { this.#赠品成本_售中损失 = value; }
    set 赠品成本_售后损失(value) { this.#赠品成本_售后损失 = value; }
    set 赠品成本_额外缴税(value) { this.#赠品成本_额外缴税 = value; }

}