
import { Entity_PlanParams } from "../../../domain/plan/Entity_PlanParams.js";
import { SimulationCore } from "../../../service/SimulationCore.js";
import Decimal from "../../../infrastructure/decimal.mjs";
self.onmessage = function (e) {
    const planParams = Entity_PlanParams.parse(e.data.planParams); // 接收主线程数据

    let volumeStart = new Decimal(e.data.saleStart);
    if (volumeStart.lte(0)) {
        volumeStart = new Decimal(0);
    }
    // saleStep,最小0.01
    let volumeStep = new Decimal(e.data.saleStep);
    if (volumeStep.lt(0.0001)) {
        volumeStep = new Decimal(0.0001);
    }
    // saleEnd,必须大于saleStart，
    const volumeEnd = new Decimal(e.data.saleEnd);
    if (volumeEnd.lte(volumeStart)) {
        volumeEnd = volumeStart.plus(volumeStep);
    }
    const results = [];
    const sc = new SimulationCore();
    console.log('%c  + start Simulation:', "color: green", performance.now());
    for (let volumePoints = volumeStart; volumePoints.lte(volumeEnd); volumePoints = volumePoints.plus(volumeStep)) {
        if (volumePoints.lte(0)) { continue; } // Volume 必须大于0
        planParams.modelPlanParamsSale.payOrderQuantity = volumePoints;
        const result = sc.runSimulation(planParams);
        results.push(result.toSerializable());
    }
    console.log('%c  + end Simulation:', "color: green", performance.now());
    self.postMessage(results); // 将结果发送回主线程
};