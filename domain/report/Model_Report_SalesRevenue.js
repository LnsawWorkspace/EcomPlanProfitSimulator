import Decimal from '../../infrastructure/decimal.mjs';
import Integer from '../../infrastructure/Integer.js';
import Money from '../../infrastructure/Money.js';
import Percentage from '../../infrastructure/Percentage.js';

export class Model_Report_SalesRevenue {
    #订单数量_退款前;
    #订单数量_退款后;
    #订单数量_售前损失;
    #订单数量_售中损失;
    #订单数量_售后损失;
    #订单数量_原始差额;

    #GMV_单;
    #GMV_退款前;
    #GMV_退款后;
    #GMV_售前损失;
    #GMV_售中损失;
    #GMV_售后损失;
    #GMV_原始差额;

    #销售金额_单;
    #销售金额_退款前;
    #销售金额_退款后;
    #销售金额_售前损失;
    #销售金额_售中损失;
    #销售金额_售后损失;
    #销售金额_原始差额;

    #收入_单;
    #收入_退款前;
    #收入_退款后;
    #收入_售前损失;
    #收入_售中损失;
    #收入_售后损失;
    #收入_原始差额;

    #明细;

    constructor() {
        this.#订单数量_退款前 = new Integer(0);
        this.#订单数量_退款后 = new Integer(0);
        this.#订单数量_售前损失 = new Integer(0);
        this.#订单数量_售中损失 = new Integer(0);
        this.#订单数量_售后损失 = new Integer(0);
        this.#订单数量_原始差额 = new Integer(0);

        this.#GMV_单 = new Money(0, 10);
        this.#GMV_退款前 = new Money(0, 10);
        this.#GMV_退款后 = new Money(0, 10);
        this.#GMV_售前损失 = new Money(0, 10);
        this.#GMV_售中损失 = new Money(0, 10);
        this.#GMV_售后损失 = new Money(0, 10);
        this.#GMV_原始差额 = new Money(0, 10);

        this.#销售金额_单 = new Money(0, 10);
        this.#销售金额_退款前 = new Money(0, 10);
        this.#销售金额_退款后 = new Money(0, 10);
        this.#销售金额_售前损失 = new Money(0, 10);
        this.#销售金额_售中损失 = new Money(0, 10);
        this.#销售金额_售后损失 = new Money(0, 10);
        this.#销售金额_原始差额 = new Money(0, 10);

        this.#收入_单 = new Money(0, 10);
        this.#收入_退款前 = new Money(0, 10);
        this.#收入_退款后 = new Money(0, 10);
        this.#收入_售前损失 = new Money(0, 10);
        this.#收入_售中损失 = new Money(0, 10);
        this.#收入_售后损失 = new Money(0, 10);
        this.#收入_原始差额 = new Money(0, 10);
        this.#明细 = [];
    }

    static parse(dto) {
        const model = new Model_Report_SalesRevenue();
        model.订单数量_退款前 = new Integer(dto.订单数量_退款前.value, dto.订单数量_退款前.options);
        model.订单数量_退款后 = new Integer(dto.订单数量_退款后.value, dto.订单数量_退款后.options);
        model.订单数量_售前损失 = new Integer(dto.订单数量_售前损失.value, dto.订单数量_售前损失.options);
        model.订单数量_售中损失 = new Integer(dto.订单数量_售中损失.value, dto.订单数量_售中损失.options);
        model.订单数量_售后损失 = new Integer(dto.订单数量_售后损失.value, dto.订单数量_售后损失.options);
        model.订单数量_原始差额 = new Integer(dto.订单数量_原始差额.value, dto.订单数量_原始差额.options);
        model.GMV_单 = new Money(dto.GMV_单.value, new Integer(dto.GMV_单.precision.value, dto.GMV_单.precision.options), dto.GMV_单.options);
        model.GMV_退款前 = new Money(dto.GMV_退款前.value, new Integer(dto.GMV_退款前.precision.value, dto.GMV_退款前.precision.options), dto.GMV_退款前.options);
        model.GMV_退款后 = new Money(dto.GMV_退款后.value, new Integer(dto.GMV_退款后.precision.value, dto.GMV_退款后.precision.options), dto.GMV_退款后.options);
        model.GMV_售前损失 = new Money(dto.GMV_售前损失.value, new Integer(dto.GMV_售前损失.precision.value, dto.GMV_售前损失.precision.options), dto.GMV_售前损失.options);
        model.GMV_售中损失 = new Money(dto.GMV_售中损失.value, new Integer(dto.GMV_售中损失.precision.value, dto.GMV_售中损失.precision.options), dto.GMV_售中损失.options);
        model.GMV_售后损失 = new Money(dto.GMV_售后损失.value, new Integer(dto.GMV_售后损失.precision.value, dto.GMV_售后损失.precision.options), dto.GMV_售后损失.options);
        model.GMV_原始差额 = new Money(dto.GMV_原始差额.value, new Integer(dto.GMV_原始差额.precision.value, dto.GMV_原始差额.precision.options), dto.GMV_原始差额.options);
        model.销售金额_单 = new Money(dto.销售金额_单.value, new Integer(dto.销售金额_单.precision.value, dto.销售金额_单.precision.options), dto.销售金额_单.options);
        model.销售金额_退款前 = new Money(dto.销售金额_退款前.value, new Integer(dto.销售金额_退款前.precision.value, dto.销售金额_退款前.precision.options), dto.销售金额_退款前.options);
        model.销售金额_退款后 = new Money(dto.销售金额_退款后.value, new Integer(dto.销售金额_退款后.precision.value, dto.销售金额_退款后.precision.options), dto.销售金额_退款后.options);
        model.销售金额_售前损失 = new Money(dto.销售金额_售前损失.value, new Integer(dto.销售金额_售前损失.precision.value, dto.销售金额_售前损失.precision.options), dto.销售金额_售前损失.options);
        model.销售金额_售中损失 = new Money(dto.销售金额_售中损失.value, new Integer(dto.销售金额_售中损失.precision.value, dto.销售金额_售中损失.precision.options), dto.销售金额_售中损失.options);
        model.销售金额_售后损失 = new Money(dto.销售金额_售后损失.value, new Integer(dto.销售金额_售后损失.precision.value, dto.销售金额_售后损失.precision.options), dto.销售金额_售后损失.options);
        model.销售金额_原始差额 = new Money(dto.销售金额_原始差额.value, new Integer(dto.销售金额_原始差额.precision.value, dto.销售金额_原始差额.precision.options), dto.销售金额_原始差额.options);
        model.收入_单 = new Money(dto.收入_单.value, new Integer(dto.收入_单.precision.value, dto.收入_单.precision.options), dto.收入_单.options);
        model.收入_退款前 = new Money(dto.收入_退款前.value, new Integer(dto.收入_退款前.precision.value, dto.收入_退款前.precision.options), dto.收入_退款前.options);
        model.收入_退款后 = new Money(dto.收入_退款后.value, new Integer(dto.收入_退款后.precision.value, dto.收入_退款后.precision.options), dto.收入_退款后.options);
        model.收入_售前损失 = new Money(dto.收入_售前损失.value, new Integer(dto.收入_售前损失.precision.value, dto.收入_售前损失.precision.options), dto.收入_售前损失.options);
        model.收入_售中损失 = new Money(dto.收入_售中损失.value, new Integer(dto.收入_售中损失.precision.value, dto.收入_售中损失.precision.options), dto.收入_售中损失.options);
        model.收入_售后损失 = new Money(dto.收入_售后损失.value, new Integer(dto.收入_售后损失.precision.value, dto.收入_售后损失.precision.options), dto.收入_售后损失.options);
        model.收入_原始差额 = new Money(dto.收入_原始差额.value, new Integer(dto.收入_原始差额.precision.value, dto.收入_原始差额.precision.options), dto.收入_原始差额.options);
        model.明细 = dto.明细.map(itemDto => Model_Report_SalesRevenue_Item.parse(itemDto));
        return model;
    }

    get GMV_单() { return this.#GMV_单; }
    get 收入_单() { return this.#收入_单; }
    get 订单数量_退款前() { return this.#订单数量_退款前; }
    get 订单数量_退款后() { return this.#订单数量_退款后; }
    get 订单数量_售前损失() { return this.#订单数量_售前损失; }
    get 订单数量_售中损失() { return this.#订单数量_售中损失; }
    get 订单数量_售后损失() { return this.#订单数量_售后损失; }
    get 订单数量_原始差额() { return this.#订单数量_原始差额; }
    get 订单数量_总退款损失() { return this.#订单数量_售前损失.plus(this.#订单数量_售中损失).plus(this.#订单数量_售后损失); }
    get 订单数量_退款校验() { return this.订单数量_总退款损失.equals(this.#订单数量_退款前.minus(this.#订单数量_退款后)); }

    get GMV_退款前() { return this.#GMV_退款前; }
    get GMV_退款后() { return this.#GMV_退款后; }
    get GMV_售前损失() { return this.#GMV_售前损失; }
    get GMV_售中损失() { return this.#GMV_售中损失; }
    get GMV_售后损失() { return this.#GMV_售后损失; }
    get GMV_原始差额() { return this.#GMV_原始差额; }
    get GMV_总退款损失() { return this.#GMV_售前损失.plus(this.#GMV_售中损失).plus(this.#GMV_售后损失); }
    get GMV_退款校验() { return this.GMV_总退款损失.equals(this.#GMV_退款前.minus(this.#GMV_退款后)); }

    get 销售金额_单() { return this.#销售金额_单; }
    get 销售金额_退款前() { return this.#销售金额_退款前; }
    get 销售金额_退款后() { return this.#销售金额_退款后; }
    get 销售金额_售前损失() { return this.#销售金额_售前损失; }
    get 销售金额_售中损失() { return this.#销售金额_售中损失; }
    get 销售金额_售后损失() { return this.#销售金额_售后损失; }
    get 销售金额_原始差额() { return this.#销售金额_原始差额; }
    get 销售金额_总退款损失() { return this.#销售金额_售前损失.plus(this.#销售金额_售中损失).plus(this.#销售金额_售后损失); }
    get 销售金额_退款校验() { return this.销售金额_总退款损失.equals(this.#销售金额_退款前.minus(this.#销售金额_退款后)); }

    get 收入_退款前() { return this.#收入_退款前; }
    get 收入_退款后() { return this.#收入_退款后; }
    get 收入_售前损失() { return this.#收入_售前损失; }
    get 收入_售中损失() { return this.#收入_售中损失; }
    get 收入_售后损失() { return this.#收入_售后损失; }
    get 收入_原始差额() { return this.#收入_原始差额; }
    get 收入_总退款损失() { return this.#收入_售前损失.plus(this.#收入_售中损失).plus(this.#收入_售后损失); }
    get 收入_退款校验() { return this.收入_总退款损失.equals(this.#收入_退款前.minus(this.#收入_退款后)); }

    get 明细() { return this.#明细; }

    set GMV_单(value) { this.#GMV_单 = value; }
    set 收入_单(value) { this.#收入_单 = value; }
    set 订单数量_退款前(value) { this.#订单数量_退款前 = value }
    set 订单数量_退款后(value) { this.#订单数量_退款后 = value }
    set 订单数量_售前损失(value) { this.#订单数量_售前损失 = value }
    set 订单数量_售中损失(value) { this.#订单数量_售中损失 = value }
    set 订单数量_售后损失(value) { this.#订单数量_售后损失 = value }
    set 订单数量_原始差额(value) { this.#订单数量_原始差额 = value }

    set GMV_退款前(value) { this.#GMV_退款前 = value }
    set GMV_退款后(value) { this.#GMV_退款后 = value }
    set GMV_售前损失(value) { this.#GMV_售前损失 = value }
    set GMV_售中损失(value) { this.#GMV_售中损失 = value }
    set GMV_售后损失(value) { this.#GMV_售后损失 = value }
    set GMV_原始差额(value) { this.#GMV_原始差额 = value }

    set 销售金额_单(value) { this.#销售金额_单 = value; }
    set 销售金额_退款前(value) { this.#销售金额_退款前 = value }
    set 销售金额_退款后(value) { this.#销售金额_退款后 = value }
    set 销售金额_售前损失(value) { this.#销售金额_售前损失 = value }
    set 销售金额_售中损失(value) { this.#销售金额_售中损失 = value }
    set 销售金额_售后损失(value) { this.#销售金额_售后损失 = value }
    set 销售金额_原始差额(value) { this.#销售金额_原始差额 = value }

    set 收入_退款前(value) { this.#收入_退款前 = value }
    set 收入_退款后(value) { this.#收入_退款后 = value }
    set 收入_售前损失(value) { this.#收入_售前损失 = value }
    set 收入_售中损失(value) { this.#收入_售中损失 = value }
    set 收入_售后损失(value) { this.#收入_售后损失 = value }
    set 收入_原始差额(value) { this.#收入_原始差额 = value }

    set 明细(value) { this.#明细 = value; }

    // 用来校验自身数据是否存在明显问题
    checkAll() {
        const errors = [];
        // - 校验明细的GMV累计是否等于总的GMV
        let 明细GMV累计 = new Money(0, 10);
        for (const item of this.#明细) {
            明细GMV累计 = 明细GMV累计.plus(item.GMV_退款前);
        }
        if (!明细GMV累计.equals(this.#GMV_退款前)) {
            errors.push(`GMV退款前校验失败，明细累计${明细GMV累计.toString()}，总计${this.#GMV_退款前.toString()}`);
        } else {
            errors.push(`GMV退款前校验通过，明细累计${明细GMV累计.toString()}，总计${this.#GMV_退款前.toString()}`);
        }

        // - 校验明细的收入累计是否等于总的收入
        let 明细收入累计 = new Money(0, 10);
        for (const item of this.#明细) {
            明细收入累计 = 明细收入累计.plus(item.收入_退款前);
        }
        if (!明细收入累计.equals(this.#收入_退款前)) {
            errors.push(`收入退款前校验失败，明细累计${明细收入累计.toString()}，总计${this.#收入_退款前.toString()}`);
        } else {
            errors.push(`收入退款前校验通过，明细累计${明细收入累计.toString()}，总计${this.#收入_退款前.toString()}`);
        }

        // - 如果明细中商品的税率完全一致，提取税率，否则返回null
        let 税率参考 = null;
        for (const item of this.#明细) {
            if (税率参考 === null) {
                税率参考 = item.商品税率;
            } else {
                if (!税率参考.equals(item.商品税率)) {
                    税率参考 = null;
                    break;
                }
            }
        }
        // - 如果税率参考不为null，则校验总收入与总GMV的税率关系
        if (税率参考 !== null) {
            const 预期收入 = this.#GMV_退款前.dividedBy(Percentage.ONE_HUNDRED_PERCENT.plus(税率参考));
            if (!预期收入.equals(this.#收入_退款前)) {
                errors.push(`GMV、税率、于收入的关系：校验失败，税率${税率参考.toString()}，预期收入${预期收入.toString()}，实际收入${this.#收入_退款前.toString()}`);
            } else {
                errors.push(`GMV、税率、于收入的关系：校验通过，税率${税率参考.toString()}，预期收入${预期收入.toString()}，实际收入${this.#收入_退款前.toString()}`);
            }
        } else {
            console.log('明细商品税率不一致，无法进行整体税率校验');
        }

        if (!this.订单数量_退款校验) {
            errors.push(`订单数量退款校验失败`);
        } else {
            errors.push(`订单数量退款校验通过`);
        }

        if (!this.GMV_退款校验) {
            errors.push(`GMV退款校验失败`);
        } else {
            errors.push(`GMV退款校验通过`);
        }

        if (!this.收入_退款校验) {
            errors.push(`收入退款校验失败`);
        } else {
            errors.push(`收入退款校验通过`);
        }

        return errors;
    }
}

export class Model_Report_SalesRevenue_Item {
    #商品名称;
    #进项税率;
    #销项税率;

    #GMV_退款前;
    #GMV_退款后;
    #GMV_售前损失;
    #GMV_售中损失;
    #GMV_售后损失;
    #GMV_原始差额;

    #销售金额_退款前;
    #销售金额_退款后;
    #销售金额_售前损失;
    #销售金额_售中损失;
    #销售金额_售后损失;
    #销售金额_原始差额;

    #收入_退款前;
    #收入_退款后;
    #收入_售前损失;
    #收入_售中损失;
    #收入_售后损失;
    #收入_原始差额;

    constructor() {
        this.#商品名称 = '';
        this.#进项税率 = new Percentage(0);
        this.#销项税率 = new Percentage(0);

        this.#GMV_退款前 = new Money(0, 10);
        this.#GMV_退款后 = new Money(0, 10);
        this.#GMV_售前损失 = new Money(0, 10);
        this.#GMV_售中损失 = new Money(0, 10);
        this.#GMV_售后损失 = new Money(0, 10);
        this.#GMV_原始差额 = new Money(0, 10);

        this.#销售金额_退款前 = new Money(0, 10);
        this.#销售金额_退款后 = new Money(0, 10);
        this.#销售金额_售前损失 = new Money(0, 10);
        this.#销售金额_售中损失 = new Money(0, 10);
        this.#销售金额_售后损失 = new Money(0, 10);
        this.#销售金额_原始差额 = new Money(0, 10);

        this.#收入_退款前 = new Money(0, 10);
        this.#收入_退款后 = new Money(0, 10);
        this.#收入_售前损失 = new Money(0, 10);
        this.#收入_售中损失 = new Money(0, 10);
        this.#收入_售后损失 = new Money(0, 10);
        this.#收入_原始差额 = new Money(0, 10);
    }

    static parse(dto) {
        const item = new Model_Report_SalesRevenue_Item();
        item.商品名称 = dto.商品名称;
        item.进项税率 = new Percentage(dto.进项税率.value, dto.进项税率.options);
        item.销项税率 = new Percentage(dto.销项税率.value, dto.销项税率.options);
        item.GMV_退款前 = new Money(dto.GMV_退款前.value, new Integer(dto.GMV_退款前.precision.value, dto.GMV_退款前.precision.options), dto.GMV_退款前.options);
        item.GMV_退款后 = new Money(dto.GMV_退款后.value, new Integer(dto.GMV_退款后.precision.value, dto.GMV_退款后.precision.options), dto.GMV_退款后.options);
        item.GMV_售前损失 = new Money(dto.GMV_售前损失.value, new Integer(dto.GMV_售前损失.precision.value, dto.GMV_售前损失.precision.options), dto.GMV_售前损失.options);
        item.GMV_售中损失 = new Money(dto.GMV_售中损失.value, new Integer(dto.GMV_售中损失.precision.value, dto.GMV_售中损失.precision.options), dto.GMV_售中损失.options);
        item.GMV_售后损失 = new Money(dto.GMV_售后损失.value, new Integer(dto.GMV_售后损失.precision.value, dto.GMV_售后损失.precision.options), dto.GMV_售后损失.options);
        item.GMV_原始差额 = new Money(dto.GMV_原始差额.value, new Integer(dto.GMV_原始差额.precision.value, dto.GMV_原始差额.precision.options), dto.GMV_原始差额.options);
        item.销售金额_退款前 = new Money(dto.销售金额_退款前.value, new Integer(dto.销售金额_退款前.precision.value, dto.销售金额_退款前.precision.options), dto.销售金额_退款前.options);
        item.销售金额_退款后 = new Money(dto.销售金额_退款后.value, new Integer(dto.销售金额_退款后.precision.value, dto.销售金额_退款后.precision.options), dto.销售金额_退款后.options);
        item.销售金额_售前损失 = new Money(dto.销售金额_售前损失.value, new Integer(dto.销售金额_售前损失.precision.value, dto.销售金额_售前损失.precision.options), dto.销售金额_售前损失.options);
        item.销售金额_售中损失 = new Money(dto.销售金额_售中损失.value, new Integer(dto.销售金额_售中损失.precision.value, dto.销售金额_售中损失.precision.options), dto.销售金额_售中损失.options);
        item.销售金额_售后损失 = new Money(dto.销售金额_售后损失.value, new Integer(dto.销售金额_售后损失.precision.value, dto.销售金额_售后损失.precision.options), dto.销售金额_售后损失.options);
        item.销售金额_原始差额 = new Money(dto.销售金额_原始差额.value, new Integer(dto.销售金额_原始差额.precision.value, dto.销售金额_原始差额.precision.options), dto.销售金额_原始差额.options);
        item.收入_退款前 = new Money(dto.收入_退款前.value, new Integer(dto.收入_退款前.precision.value, dto.收入_退款前.precision.options), dto.收入_退款前.options);
        item.收入_退款后 = new Money(dto.收入_退款后.value, new Integer(dto.收入_退款后.precision.value, dto.收入_退款后.precision.options), dto.收入_退款后.options);
        item.收入_售前损失 = new Money(dto.收入_售前损失.value, new Integer(dto.收入_售前损失.precision.value, dto.收入_售前损失.precision.options), dto.收入_售前损失.options);
        item.收入_售中损失 = new Money(dto.收入_售中损失.value, new Integer(dto.收入_售中损失.precision.value, dto.收入_售中损失.precision.options), dto.收入_售中损失.options);
        item.收入_售后损失 = new Money(dto.收入_售后损失.value, new Integer(dto.收入_售后损失.precision.value, dto.收入_售后损失.precision.options), dto.收入_售后损失.options);
        item.收入_原始差额 = new Money(dto.收入_原始差额.value, new Integer(dto.收入_原始差额.precision.value, dto.收入_原始差额.precision.options), dto.收入_原始差额.options);
        return item;
    }

    get 商品名称() { return this.#商品名称; }
    get 进项税率() { return this.#进项税率; }
    get 销项税率() { return this.#销项税率; }

    get GMV_退款前() { return this.#GMV_退款前; }
    get GMV_退款后() { return this.#GMV_退款后; }
    get GMV_售前损失() { return this.#GMV_售前损失; }
    get GMV_售中损失() { return this.#GMV_售中损失; }
    get GMV_售后损失() { return this.#GMV_售后损失; }
    get GMV_原始差额() { return this.#GMV_原始差额; }
    get GMV_总退款损失() { return this.#GMV_售前损失.plus(this.#GMV_售中损失).plus(this.#GMV_售后损失); }
    get GMV_退款校验() { return this.GMV_总退款损失.equals(this.#GMV_退款前.minus(this.#GMV_退款后)); }

    get 销售金额_退款前() { return this.#销售金额_退款前; }
    get 销售金额_退款后() { return this.#销售金额_退款后; }
    get 销售金额_售前损失() { return this.#销售金额_售前损失; }
    get 销售金额_售中损失() { return this.#销售金额_售中损失; }
    get 销售金额_售后损失() { return this.#销售金额_售后损失; }
    get 销售金额_原始差额() { return this.#销售金额_原始差额; }
    get 销售金额_总退款损失() { return this.#销售金额_售前损失.plus(this.#销售金额_售中损失).plus(this.#销售金额_售后损失); }
    get 销售金额_退款校验() { return this.销售金额_总退款损失.equals(this.#销售金额_退款前.minus(this.#销售金额_退款后)); }

    get 收入_退款前() { return this.#收入_退款前; }
    get 收入_退款后() { return this.#收入_退款后; }
    get 收入_售前损失() { return this.#收入_售前损失; }
    get 收入_售中损失() { return this.#收入_售中损失; }
    get 收入_售后损失() { return this.#收入_售后损失; }
    get 收入_原始差额() { return this.#收入_原始差额; }
    get 收入_总退款损失() { return this.#收入_售前损失.plus(this.#收入_售中损失).plus(this.#收入_售后损失); }
    get 收入_退款校验() { return this.收入_总退款损失.equals(this.#收入_退款前.minus(this.#收入_退款后)); }

    set 商品名称(value) { this.#商品名称 = value; }
    set 进项税率(value) { this.#进项税率 = value; }
    set 销项税率(value) { this.#销项税率 = value; }

    set GMV_退款前(value) { this.#GMV_退款前 = value }
    set GMV_退款后(value) { this.#GMV_退款后 = value }
    set GMV_售前损失(value) { this.#GMV_售前损失 = value }
    set GMV_售中损失(value) { this.#GMV_售中损失 = value }
    set GMV_售后损失(value) { this.#GMV_售后损失 = value }
    set GMV_原始差额(value) { this.#GMV_原始差额 = value }

    set 销售金额_退款前(value) { this.#销售金额_退款前 = value }
    set 销售金额_退款后(value) { this.#销售金额_退款后 = value }
    set 销售金额_售前损失(value) { this.#销售金额_售前损失 = value }
    set 销售金额_售中损失(value) { this.#销售金额_售中损失 = value }
    set 销售金额_售后损失(value) { this.#销售金额_售后损失 = value }
    set 销售金额_原始差额(value) { this.#销售金额_原始差额 = value }

    set 收入_退款前(value) { this.#收入_退款前 = value }
    set 收入_退款后(value) { this.#收入_退款后 = value }
    set 收入_售前损失(value) { this.#收入_售前损失 = value }
    set 收入_售中损失(value) { this.#收入_售中损失 = value }
    set 收入_售后损失(value) { this.#收入_售后损失 = value }
    set 收入_原始差额(value) { this.#收入_原始差额 = value }
}