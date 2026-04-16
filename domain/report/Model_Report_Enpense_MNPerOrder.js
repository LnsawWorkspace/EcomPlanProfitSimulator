import Decimal from '../../infrastructure/decimal.mjs';
import Integer from '../../infrastructure/Integer.js';
import Money from '../../infrastructure/Money.js';
import Percentage from '../../infrastructure/Percentage.js';

export class Model_Report_Enpense_MNPerOrder {

    #费用成本_退款前;
    #费用成本_退款后;
    #费用成本_售前损失;
    #费用成本_售中损失;
    #费用成本_售后损失;

    #明细;

    constructor() {
        this.#费用成本_退款前 = new Money(0, 4);
        this.#费用成本_退款后 = new Money(0, 4);
        this.#费用成本_售前损失 = new Money(0, 4);
        this.#费用成本_售中损失 = new Money(0, 4);
        this.#费用成本_售后损失 = new Money(0, 4);

        this.#明细 = [];
    }

    static parse(dto) {
        const model = new Model_Report_Enpense_MNPerOrder();
        model.费用成本_退款前 = new Money(dto.费用成本_退款前.value, new Integer(dto.费用成本_退款前.precision.value, dto.费用成本_退款前.precision.options), dto.费用成本_退款前.options);
        model.费用成本_退款后 = new Money(dto.费用成本_退款后.value, new Integer(dto.费用成本_退款后.precision.value, dto.费用成本_退款后.precision.options), dto.费用成本_退款后.options);
        model.费用成本_售前损失 = new Money(dto.费用成本_售前损失.value, new Integer(dto.费用成本_售前损失.precision.value, dto.费用成本_售前损失.precision.options), dto.费用成本_售前损失.options);
        model.费用成本_售中损失 = new Money(dto.费用成本_售中损失.value, new Integer(dto.费用成本_售中损失.precision.value, dto.费用成本_售中损失.precision.options), dto.费用成本_售中损失.options);
        model.费用成本_售后损失 = new Money(dto.费用成本_售后损失.value, new Integer(dto.费用成本_售后损失.precision.value, dto.费用成本_售后损失.precision.options), dto.费用成本_售后损失.options);
        model.明细 = dto.明细.map(itemDto => Model_Report_Enpense_MNPerOrder_Item.parse(itemDto));
        return model;
    }

    get 费用成本_退款前() { return this.#费用成本_退款前; }
    get 费用成本_退款后() { return this.#费用成本_退款后; }
    get 费用成本_售前损失() { return this.#费用成本_售前损失; }
    get 费用成本_售中损失() { return this.#费用成本_售中损失; }
    get 费用成本_售后损失() { return this.#费用成本_售后损失; }
    get 费用成本_总退款损失() { return this.#费用成本_售前损失.plus(this.#费用成本_售中损失).plus(this.#费用成本_售后损失); }
    // get 费用成本_退款校验() { return this.费用成本_总退款损失.equals(this.#费用成本_退款前.minus(this.#费用成本_退款后)); }
    get 费用成本_有效成本() { return this.#费用成本_退款后.plus(this.费用成本_总退款损失); }

    get 明细() { return this.#明细; }

    set 费用成本_退款前(value) { this.#费用成本_退款前 = value; }
    set 费用成本_退款后(value) { this.#费用成本_退款后 = value; }
    set 费用成本_售前损失(value) { this.#费用成本_售前损失 = value; }
    set 费用成本_售中损失(value) { this.#费用成本_售中损失 = value; }
    set 费用成本_售后损失(value) { this.#费用成本_售后损失 = value; }

    set 明细(value) { this.#明细 = value; }

    checkAll() {
        const errors = [];
        let 明细成本累计 = new Money(0, 10);
        for (const item of this.#明细) {
            明细成本累计 = 明细成本累计.plus(item.费用成本_退款前);
        }
        if (!明细成本累计.equals(this.#费用成本_退款前)) {
            errors.push(`费用成本_退款前校验失败，明细累计${明细成本累计.toString()}，总计${this.#费用成本_退款前.toString()}`);
        } else {
            errors.push(`费用成本_退款前校验通过，明细累计${明细成本累计.toString()}，总计${this.#费用成本_退款前.toString()}`);
        }

        return errors;
    }

}

export class Model_Report_Enpense_MNPerOrder_Item {
    #费用名称;
    #费用成本_含税;
    #费用成本_不含税;
    #进项税率;

    #订单数量_退款前;
    #订单数量_退款后;
    #订单数量_售前损失;
    #订单数量_售中损失;
    #订单数量_售后损失;
    #订单数量_原始差额;

    #费用成本_退款前;
    #费用成本_退款后;
    #费用成本_售前损失;
    #费用成本_售中损失;
    #费用成本_售后损失;

    constructor() {
        this.#费用名称 = '';
        this.#进项税率 = new Percentage(0, 4);

        this.#订单数量_退款前 = new Integer(0);
        this.#订单数量_退款后 = new Integer(0);
        this.#订单数量_售前损失 = new Integer(0);
        this.#订单数量_售中损失 = new Integer(0);
        this.#订单数量_售后损失 = new Integer(0);

        this.#费用成本_退款前 = new Money(0, 4);
        this.#费用成本_退款后 = new Money(0, 4);
        this.#费用成本_售前损失 = new Money(0, 4);
        this.#费用成本_售中损失 = new Money(0, 4);
        this.#费用成本_售后损失 = new Money(0, 4);
    }

    static parse(dto) {
        const model = new Model_Report_Enpense_MNPerOrder_Item();
        model.费用名称 = dto.费用名称;
        model.费用成本_含税 = new Money(dto.费用成本_含税.value, new Integer(dto.费用成本_含税.precision.value, dto.费用成本_含税.precision.options), dto.费用成本_含税.options);
        model.费用成本_不含税 = new Money(dto.费用成本_不含税.value, new Integer(dto.费用成本_不含税.precision.value, dto.费用成本_不含税.precision.options), dto.费用成本_不含税.options);
        model.进项税率 = new Percentage(dto.进项税率.value, dto.进项税率.options);
        model.订单数量_退款前 = new Integer(dto.订单数量_退款前.value, dto.订单数量_退款前.options);
        model.订单数量_退款后 = new Integer(dto.订单数量_退款后.value, dto.订单数量_退款后.options);
        model.订单数量_售前损失 = new Integer(dto.订单数量_售前损失.value, dto.订单数量_售前损失.options);
        model.订单数量_售中损失 = new Integer(dto.订单数量_售中损失.value, dto.订单数量_售中损失.options);
        model.订单数量_售后损失 = new Integer(dto.订单数量_售后损失.value, dto.订单数量_售后损失.options);
        model.订单数量_原始差额 = new Integer(dto.订单数量_原始差额.value, dto.订单数量_原始差额.options);
        model.费用成本_退款前 = new Money(dto.费用成本_退款前.value, new Integer(dto.费用成本_退款前.precision.value, dto.费用成本_退款前.precision.options), dto.费用成本_退款前.options);
        model.费用成本_退款后 = new Money(dto.费用成本_退款后.value, new Integer(dto.费用成本_退款后.precision.value, dto.费用成本_退款后.precision.options), dto.费用成本_退款后.options);
        model.费用成本_售前损失 = new Money(dto.费用成本_售前损失.value, new Integer(dto.费用成本_售前损失.precision.value, dto.费用成本_售前损失.precision.options), dto.费用成本_售前损失.options);
        model.费用成本_售中损失 = new Money(dto.费用成本_售中损失.value, new Integer(dto.费用成本_售中损失.precision.value, dto.费用成本_售中损失.precision.options), dto.费用成本_售中损失.options);
        model.费用成本_售后损失 = new Money(dto.费用成本_售后损失.value, new Integer(dto.费用成本_售后损失.precision.value, dto.费用成本_售后损失.precision.options), dto.费用成本_售后损失.options);
        return model;
    }

    get 费用名称() { return this.#费用名称; }
    get 费用成本_含税() { return this.#费用成本_含税; }
    get 费用成本_不含税() { return this.#费用成本_不含税; }
    get 进项税率() { return this.#进项税率; }

    get 订单数量_退款前() { return this.#订单数量_退款前; }
    get 订单数量_退款后() { return this.#订单数量_退款后; }
    get 订单数量_售前损失() { return this.#订单数量_售前损失; }
    get 订单数量_售中损失() { return this.#订单数量_售中损失; }
    get 订单数量_售后损失() { return this.#订单数量_售后损失; }
    get 订单数量_原始差额() { return this.#订单数量_原始差额; }
    get 订单数量_总退款损失() { return this.#订单数量_售前损失.plus(this.#订单数量_售中损失).plus(this.#订单数量_售后损失); }
    get 订单数量_退款校验() { return this.订单数量_总退款损失.equals(this.#订单数量_退款前.minus(this.#订单数量_退款后)); }

    get 费用成本_退款前() { return this.#费用成本_退款前; }
    get 费用成本_退款后() { return this.#费用成本_退款后; }
    get 费用成本_售前损失() { return this.#费用成本_售前损失; }
    get 费用成本_售中损失() { return this.#费用成本_售中损失; }
    get 费用成本_售后损失() { return this.#费用成本_售后损失; }
    get 费用成本_总退款损失() { return this.#费用成本_售前损失.plus(this.#费用成本_售中损失).plus(this.#费用成本_售后损失); }
    // get 费用成本_退款校验() { return this.费用成本_总退款损失.equals(this.#费用成本_退款前.minus(this.#费用成本_退款后)); }
    get 费用成本_有效成本() { return this.#费用成本_退款后.plus(this.费用成本_总退款损失); }

    set 费用名称(value) { this.#费用名称 = value; }
    set 费用成本_含税(value) { this.#费用成本_含税 = value; }
    set 费用成本_不含税(value) { this.#费用成本_不含税 = value; }
    set 进项税率(value) { this.#进项税率 = value; }

    set 订单数量_退款前(value) { this.#订单数量_退款前 = value }
    set 订单数量_退款后(value) { this.#订单数量_退款后 = value }
    set 订单数量_售前损失(value) { this.#订单数量_售前损失 = value }
    set 订单数量_售中损失(value) { this.#订单数量_售中损失 = value }
    set 订单数量_售后损失(value) { this.#订单数量_售后损失 = value }
    set 订单数量_原始差额(value) { this.#订单数量_原始差额 = value }

    set 费用成本_退款前(value) { this.#费用成本_退款前 = value; }
    set 费用成本_退款后(value) { this.#费用成本_退款后 = value; }
    set 费用成本_售前损失(value) { this.#费用成本_售前损失 = value; }
    set 费用成本_售中损失(value) { this.#费用成本_售中损失 = value; }
    set 费用成本_售后损失(value) { this.#费用成本_售后损失 = value; }

}