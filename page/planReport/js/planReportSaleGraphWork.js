
import { Entity_PlanParams } from "../../../domain/plan/Entity_PlanParams.js";
import { SimulationCore } from "../../../service/SimulationCore.js";
import Decimal from "../../../infrastructure/decimal.mjs";
self.onmessage = function (e) {
    const planParams = Entity_PlanParams.parse(e.data.planParams); // 接收主线程数据

    let saleStart = new Decimal(e.data.saleStart);
    if (saleStart.lte(0)) {
        saleStart = new Decimal(0);
    }
    // saleStep,最小0.01
    let saleStep = new Decimal(e.data.saleStep);
    if (saleStep.lt(0.0001)) {
        saleStep = new Decimal(0.0001);
    }
    // saleEnd,必须大于saleStart，
    const saleEnd = new Decimal(e.data.saleEnd);
    if (saleEnd.lte(saleStart)) {
        saleEnd = saleStart.plus(saleStep);
    }
    const results = [];
    const sc = new SimulationCore();
    console.log('%c  + start Simulation:', "color: green", performance.now());
    for (let salePoints = saleStart; salePoints.lte(saleEnd); salePoints = salePoints.plus(saleStep)) {
        if (salePoints.lte(0)) { continue; } // Sale 必须大于0
        planParams.modelPlanParamsSale.salePrice = salePoints;
        const result = sc.runSimulation(planParams);
        results.push(result.toSerializable());
    }
    console.log('%c  + end Simulation:', "color: green", performance.now());
    self.postMessage(results); // 将结果发送回主线程
};