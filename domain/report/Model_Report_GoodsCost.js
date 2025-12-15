import Decimal from '../../infrastructure/decimal.mjs';
import Integer from '../../infrastructure/Integer.js';
import Money from '../../infrastructure/Money.js';
import Percentage from '../../infrastructure/Percentage.js';

export class Model_Report_GoodsCost {
    #商品成本_退款前;
    #商品成本_退款后;
    #商品成本_售前损失;
    #商品成本_售中损失;
    #商品成本_售后损失;

    #明细;

    constructor() {
        this.#商品成本_退款前 = new Money(0, 4);
        this.#商品成本_退款后 = new Money(0, 4);
        this.#商品成本_售前损失 = new Money(0, 4);
        this.#商品成本_售中损失 = new Money(0, 4);
        this.#商品成本_售后损失 = new Money(0, 4);

        this.#明细 = [];
    }

    get 商品成本_退款前() { return this.#商品成本_退款前; }
    get 商品成本_退款后() { return this.#商品成本_退款后; }
    get 商品成本_售前损失() { return this.#商品成本_售前损失; }
    get 商品成本_售中损失() { return this.#商品成本_售中损失; }
    get 商品成本_售后损失() { return this.#商品成本_售后损失; }
    get 商品成本_总退款损失() { return this.#商品成本_售前损失.plus(this.#商品成本_售中损失).plus(this.#商品成本_售后损失); }
    // get 商品成本_退款校验() { return this.商品成本_总退款损失.equals(this.#商品成本_退款前.minus(this.#商品成本_退款后)); }
    get 商品成本_有效成本() { return this.#商品成本_退款后.plus(this.商品成本_总退款损失); }

    get 明细() { return this.#明细; }

    set 商品成本_退款前(value) { this.#商品成本_退款前 = value; }
    set 商品成本_退款后(value) { this.#商品成本_退款后 = value; }
    set 商品成本_售前损失(value) { this.#商品成本_售前损失 = value; }
    set 商品成本_售中损失(value) { this.#商品成本_售中损失 = value; }
    set 商品成本_售后损失(value) { this.#商品成本_售后损失 = value; }

    checkAll() {
        const errors = [];
        let 明细成本累计 = new Money(0, 10);
        for (const item of this.#明细) {
            明细成本累计 = 明细成本累计.plus(item.商品成本_退款前);
        }
        if (!明细成本累计.equals(this.#商品成本_退款前)) {
            errors.push(`商品成本_退款前校验失败，明细累计${明细成本累计.toString()}，总计${this.#商品成本_退款前.toString()}`);
        } else {
            errors.push(`商品成本_退款前校验通过，明细累计${明细成本累计.toString()}，总计${this.#商品成本_退款前.toString()}`);
        }

        return errors;
    }

}

export class Model_Report_GoodsCost_Item {
    #商品名称;
    #商品成本_含税;
    #商品成本_不含税;
    #进项税率;

    #商品数量_退款前;
    #商品数量_退款后;
    #商品数量_售前损失;
    #商品数量_售中损失;
    #商品数量_售后损失;

    #商品成本_退款前;
    #商品成本_退款后;
    #商品成本_售前损失;
    #商品成本_售中损失;
    #商品成本_售后损失;

    constructor() {
        this.#商品名称 = '';
        this.#进项税率 = new Percentage(0, 4);

        this.#商品数量_退款前 = new Integer(0);
        this.#商品数量_退款后 = new Integer(0);
        this.#商品数量_售前损失 = new Integer(0);
        this.#商品数量_售中损失 = new Integer(0);
        this.#商品数量_售后损失 = new Integer(0);

        this.#商品成本_退款前 = new Money(0, 4);
        this.#商品成本_退款后 = new Money(0, 4);
        this.#商品成本_售前损失 = new Money(0, 4);
        this.#商品成本_售中损失 = new Money(0, 4);
        this.#商品成本_售后损失 = new Money(0, 4);
    }
    get 商品名称() { return this.#商品名称; }
    get 商品成本_含税() { return this.#商品成本_含税; }
    get 商品成本_不含税() { return this.#商品成本_不含税; }
    get 进项税率() { return this.#进项税率; }

    get 商品数量_退款前() { return this.#商品数量_退款前; }
    get 商品数量_退款后() { return this.#商品数量_退款后; }
    get 商品数量_售前损失() { return this.#商品数量_售前损失; }
    get 商品数量_售中损失() { return this.#商品数量_售中损失; }
    get 商品数量_售后损失() { return this.#商品数量_售后损失; }
    get 商品数量_总退款损失() { return this.#商品数量_售前损失.plus(this.#商品数量_售中损失).plus(this.#商品数量_售后损失); }
    // get 商品数量_退款校验() { return this.商品数量_总退款损失.equals(this.#商品数量_退款前.minus(this.#商品数量_退款后)); }
    get 商品数量_有效数量() { return this.#商品数量_退款后.plus(this.商品数量_总退款损失); }

    get 商品成本_退款前() { return this.#商品成本_退款前; }
    get 商品成本_退款后() { return this.#商品成本_退款后; }
    get 商品成本_售前损失() { return this.#商品成本_售前损失; }
    get 商品成本_售中损失() { return this.#商品成本_售中损失; }
    get 商品成本_售后损失() { return this.#商品成本_售后损失; }
    get 商品成本_总退款损失() { return this.#商品成本_售前损失.plus(this.#商品成本_售中损失).plus(this.#商品成本_售后损失); }
    // get 商品成本_退款校验() { return this.商品成本_总退款损失.equals(this.#商品成本_退款前.minus(this.#商品成本_退款后)); }
    get 商品成本_有效成本() { return this.#商品成本_退款后.plus(this.商品成本_总退款损失); }

    set 商品名称(value) { this.#商品名称 = value; }
    set 商品成本_含税(value) { this.#商品成本_含税 = value; }
    set 商品成本_不含税(value) { this.#商品成本_不含税 = value; }
    set 进项税率(value) { this.#进项税率 = value; }

    set 商品数量_退款前(value) { this.#商品数量_退款前 = value; }
    set 商品数量_退款后(value) { this.#商品数量_退款后 = value; }
    set 商品数量_售前损失(value) { this.#商品数量_售前损失 = value; }
    set 商品数量_售中损失(value) { this.#商品数量_售中损失 = value; }
    set 商品数量_售后损失(value) { this.#商品数量_售后损失 = value; }

    set 商品成本_退款前(value) { this.#商品成本_退款前 = value; }
    set 商品成本_退款后(value) { this.#商品成本_退款后 = value; }
    set 商品成本_售前损失(value) { this.#商品成本_售前损失 = value; }
    set 商品成本_售中损失(value) { this.#商品成本_售中损失 = value; }
    set 商品成本_售后损失(value) { this.#商品成本_售后损失 = value; }

}