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
    /**
     * 当赠品视为销售的时候，虽然会计上不计入收入，但税务上是要计入收入的。
     * 该收入会有一定的税务影响，比如广告费的企业所得税应税金额年度最大抵扣上限会变化。
     */
    #赠品成本_额外收入;

    #明细;

    constructor() {
        this.#赠品成本_退款前 = new Money(0, 4);
        this.#赠品成本_退款后 = new Money(0, 4);
        this.#赠品成本_售前损失 = new Money(0, 4);
        this.#赠品成本_售中损失 = new Money(0, 4);
        this.#赠品成本_售后损失 = new Money(0, 4);
        this.#赠品成本_额外缴税 = new Money(0, 4);
        this.#赠品成本_额外收入 = new Money(0, 4);
        this.#明细 = [];
    }

    get 赠品成本_退款前() { return this.#赠品成本_退款前; }
    get 赠品成本_退款后() { return this.#赠品成本_退款后; }
    get 赠品成本_售前损失() { return this.#赠品成本_售前损失; }
    get 赠品成本_售中损失() { return this.#赠品成本_售中损失; }
    get 赠品成本_售后损失() { return this.#赠品成本_售后损失; }
    get 赠品成本_总退款损失() { return this.#赠品成本_售前损失.plus(this.#赠品成本_售中损失).plus(this.#赠品成本_售后损失); }
    get 赠品成本_额外缴税() { return this.#赠品成本_额外缴税; }
    get 赠品成本_额外收入() { return this.#赠品成本_额外收入; }
    get 赠品成本_有效成本() { return this.#赠品成本_退款后.plus(this.赠品成本_总退款损失).plus(this.#赠品成本_额外缴税); }

    get 明细() { return this.#明细; }

    set 赠品成本_退款前(value) { this.#赠品成本_退款前 = value; }
    set 赠品成本_退款后(value) { this.#赠品成本_退款后 = value; }
    set 赠品成本_售前损失(value) { this.#赠品成本_售前损失 = value; }
    set 赠品成本_售中损失(value) { this.#赠品成本_售中损失 = value; }
    set 赠品成本_售后损失(value) { this.#赠品成本_售后损失 = value; }
    set 赠品成本_额外缴税(value) { this.#赠品成本_额外缴税 = value; }
    set 赠品成本_额外收入(value) { this.#赠品成本_额外收入 = value; }

    static parse(dto) {
        const model = new Model_Report_GiftCost();
        model.赠品成本_退款前 = new Money(dto.赠品成本_退款前.value, new Integer(dto.赠品成本_退款前.precision.value, dto.赠品成本_退款前.precision.options), dto.赠品成本_退款前.options);
        model.赠品成本_退款后 = new Money(dto.赠品成本_退款后.value, new Integer(dto.赠品成本_退款后.precision.value, dto.赠品成本_退款后.precision.options), dto.赠品成本_退款后.options);
        model.赠品成本_售前损失 = new Money(dto.赠品成本_售前损失.value, new Integer(dto.赠品成本_售前损失.precision.value, dto.赠品成本_售前损失.precision.options), dto.赠品成本_售前损失.options);
        model.赠品成本_售中损失 = new Money(dto.赠品成本_售中损失.value, new Integer(dto.赠品成本_售中损失.precision.value, dto.赠品成本_售中损失.precision.options), dto.赠品成本_售中损失.options);
        model.赠品成本_售后损失 = new Money(dto.赠品成本_售后损失.value, new Integer(dto.赠品成本_售后损失.precision.value, dto.赠品成本_售后损失.precision.options), dto.赠品成本_售后损失.options);
        model.赠品成本_额外缴税 = new Money(dto.赠品成本_额外缴税.value, new Integer(dto.赠品成本_额外缴税.precision.value, dto.赠品成本_额外缴税.precision.options), dto.赠品成本_额外缴税.options);
        model.赠品成本_额外收入 = new Money(dto.赠品成本_额外收入.value, new Integer(dto.赠品成本_额外收入.precision.value, dto.赠品成本_额外收入.precision.options), dto.赠品成本_额外收入.options);
        model.#明细 = (dto.明细 || []).map(itemDto => Model_Report_GiftCost_Item.parse(itemDto));
        return model;
    }

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
    #赠品成本_额外收入;

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
        this.#赠品成本_额外收入 = new Money(0, 4);
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
    get 赠品成本_额外收入() { return this.#赠品成本_额外收入; }
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
    set 赠品成本_额外收入(value) { this.#赠品成本_额外收入 = value; }

    static parse(dto) {
        const item = new Model_Report_GiftCost_Item();
        item.赠品名称 = dto.赠品名称;
        item.赠品成本_含税 = new Money(dto.赠品成本_含税.value, new Integer(dto.赠品成本_含税.precision.value, dto.赠品成本_含税.precision.options), dto.赠品成本_含税.options);
        item.赠品成本_不含税 = new Money(dto.赠品成本_不含税.value, new Integer(dto.赠品成本_不含税.precision.value, dto.赠品成本_不含税.precision.options), dto.赠品成本_不含税.options);
        item.进项税率 = new Percentage(dto.进项税率.value, dto.进项税率.options);
        item.赠品数量_退款前 = new Integer(dto.赠品数量_退款前.value, dto.赠品数量_退款前.options);
        item.赠品数量_退款后 = new Integer(dto.赠品数量_退款后.value, dto.赠品数量_退款后.options);
        item.赠品数量_售前损失 = new Integer(dto.赠品数量_售前损失.value, dto.赠品数量_售前损失.options);
        item.赠品数量_售中损失 = new Integer(dto.赠品数量_售中损失.value, dto.赠品数量_售中损失.options);
        item.赠品数量_售后损失 = new Integer(dto.赠品数量_售后损失.value, dto.赠品数量_售后损失.options);
        item.赠品成本_退款前 = new Money(dto.赠品成本_退款前.value, new Integer(dto.赠品成本_退款前.precision.value, dto.赠品成本_退款前.precision.options), dto.赠品成本_退款前.options);
        item.赠品成本_退款后 = new Money(dto.赠品成本_退款后.value, new Integer(dto.赠品成本_退款后.precision.value, dto.赠品成本_退款后.precision.options), dto.赠品成本_退款后.options);
        item.赠品成本_售前损失 = new Money(dto.赠品成本_售前损失.value, new Integer(dto.赠品成本_售前损失.precision.value, dto.赠品成本_售前损失.precision.options), dto.赠品成本_售前损失.options);
        item.赠品成本_售中损失 = new Money(dto.赠品成本_售中损失.value, new Integer(dto.赠品成本_售中损失.precision.value, dto.赠品成本_售中损失.precision.options), dto.赠品成本_售中损失.options);
        item.赠品成本_售后损失 = new Money(dto.赠品成本_售后损失.value, new Integer(dto.赠品成本_售后损失.precision.value, dto.赠品成本_售后损失.precision.options), dto.赠品成本_售后损失.options);
        item.赠品成本_额外缴税 = new Money(dto.赠品成本_额外缴税.value, new Integer(dto.赠品成本_额外缴税.precision.value, dto.赠品成本_额外缴税.precision.options), dto.赠品成本_额外缴税.options);
        item.赠品成本_额外收入 = new Money(dto.赠品成本_额外收入.value, new Integer(dto.赠品成本_额外收入.precision.value, dto.赠品成本_额外收入.precision.options), dto.赠品成本_额外收入.options);
        return item;
    }
}