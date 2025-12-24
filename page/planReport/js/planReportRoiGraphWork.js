
import { Entity_PlanParams } from "../../../domain/plan/Entity_PlanParams.js";
import { SimulationCore } from "../../../service/SimulationCore.js";
import Decimal from "../../../infrastructure/decimal.mjs";
self.onmessage = function (e) {
    const planParams = Entity_PlanParams.parse(e.data.planParams); // 接收主线程数据

    let roiStart = new Decimal(e.data.roiStart);
    if (roiStart.lte(0)) {
        roiStart = new Decimal(0);
    }
    // roiStep,最小0.01
    let roiStep = new Decimal(e.data.roiStep);
    if (roiStep.lt(0.0001)) {
        roiStep = new Decimal(0.0001);
    }
    // roiEnd,必须大于roiStart，
    const roiEnd = new Decimal(e.data.roiEnd);

    const results = [];
    const sc = new SimulationCore();
    console.log('%c  + start Simulation:', "color: green", performance.now());
    for (let roigraphPoints = roiStart; roigraphPoints.lte(roiEnd); roigraphPoints = roigraphPoints.plus(roiStep)) {
        if (roigraphPoints.lte(0)) { continue; } // ROI 必须大于0
        planParams.modelPlanParamsAdvertising.roi = roigraphPoints;
        const result = sc.runSimulation(planParams);
        results.push(result.toSerializable());
    }
    console.log('%c  + start Simulation:', "color: green", performance.now());
    self.postMessage(results); // 将结果发送回主线程
};