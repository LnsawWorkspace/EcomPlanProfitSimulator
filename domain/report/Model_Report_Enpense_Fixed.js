import Decimal from '../../infrastructure/decimal.mjs';
import Integer from '../../infrastructure/Integer.js';
import Money from '../../infrastructure/Money.js';
import Percentage from '../../infrastructure/Percentage.js';

export class Model_Report_Enpense_Fixed {
    #费用成本;
    #明细;
    constructor() {
        this.#费用成本 = new Money(0, 4);
        this.#明细 = [];
    }
    get 费用成本() { return this.#费用成本; }
    get 明细() { return this.#明细; }
    set 费用成本(value) { this.#费用成本 = value; }
    set 明细(value) { this.#明细 = value; }
    static parse(dto) {
        const model = new Model_Report_Enpense_Fixed();
        model.费用成本 = new Money(dto.费用成本.value, new Integer(dto.费用成本.precision.value, dto.费用成本.precision.options), dto.费用成本.options);
        model.明细 = dto.明细.map(itemDto => Model_Report_Enpense_Fixed_Item.parse(itemDto));
        return model;
    }
}

export class Model_Report_Enpense_Fixed_Item {
    #费用名称;
    #进项税率;

    #费用成本;

    constructor() {
        this.#费用名称 = '';
        this.#进项税率 = new Percentage(0, 4);

        this.#费用成本 = new Money(0, 4);
    }

    static parse(dto) {
        const model = new Model_Report_Enpense_Fixed_Item();
        model.费用名称 = dto.费用名称;
        model.进项税率 = new Percentage(dto.进项税率.value, dto.进项税率.options);
        model.费用成本 = new Money(dto.费用成本.value, new Integer(dto.费用成本.precision.value, dto.费用成本.precision.options), dto.费用成本.options);
        return model;
    }

    get 费用名称() { return this.#费用名称; }
    get 进项税率() { return this.#进项税率; }
    get 费用成本() { return this.#费用成本; }

    set 费用名称(value) { this.#费用名称 = value; }
    set 进项税率(value) { this.#进项税率 = value; }
    set 费用成本(value) { this.#费用成本 = value; }

}