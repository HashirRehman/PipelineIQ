"use client";

// Apache ECharts' own recommended React setup (echarts-for-react README,
// "Import ECharts.js modules manually to reduce bundle size"): import the
// core module, register only the chart types / components actually used,
// and render through echarts-for-react's core component. No hand-rolled
// echarts.init/dispose lifecycle — that responsibility belongs to the
// library that's built and maintained for exactly this integration.
import * as echarts from "echarts/core";
import { LineChart, BarChart, PieChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([LineChart, BarChart, PieChart, GridComponent, TooltipComponent, CanvasRenderer]);

export { echarts };
