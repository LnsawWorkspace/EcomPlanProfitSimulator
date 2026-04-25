
import { Entity_PlanParams } from "../../../domain/plan/Entity_PlanParams.js";
import { SimulationCore } from "../../../service/SimulationCore.js";
import Decimal from "../../../infrastructure/decimal.mjs";
self.onmessage = function (e) {
    const planParams = Entity_PlanParams.parse(e.data.planParams); // 接收主线程数据

    let volumeStart = new Decimal(e.data.volumeStart);
    if (volumeStart.lte(0)) {
        volumeStart = new Decimal(0);
    }
    // volumeStep,最小1
    let volumeStep = new Decimal(e.data.volumeStep);
    if (volumeStep.lt(1)) {
        volumeStep = new Decimal(1);
    }
    // volumeEnd,必须大于volumeStart，
    const volumeEnd = new Decimal(e.data.volumeEnd);
    if (volumeEnd.lte(volumeStart)) {
        volumeEnd = volumeStart.plus(volumeStep);
    }
    const results = [];
    const sc = new SimulationCore();
    console.log('%c  + start Simulation:', "color: green", performance.now());
    for (let volumePoints = volumeStart; volumePoints.lte(volumeEnd); volumePoints = volumePoints.plus(volumeStep)) {
        if (volumePoints.lte(0)) { continue; } // Volume 必须大于0
        for (let roiPoints = new Decimal(e.data.roiStart); roiPoints.lte(new Decimal(e.data.roiEnd)); roiPoints = roiPoints.plus(new Decimal(e.data.roiStep))) {
            if (roiPoints.lte(0)) { continue; } // ROI 必须大于0
            planParams.modelPlanParamsSale.payOrderQuantity = volumePoints;
            planParams.modelPlanParamsAdvertising.roi = roiPoints;
            const result = sc.runSimulation(planParams);
            results.push(result.toSerializable());
        }
    }
    console.log('%c  + end Simulation:', "color: green", performance.now());
    self.postMessage(results); // 将结果发送回主线程
};