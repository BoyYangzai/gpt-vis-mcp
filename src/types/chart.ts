// 数据字段元信息
export interface DataMeta {
  name: string;
  dataType: 'string' | 'number' | 'date' | 'boolean';
}

// vis-chart 格式的图表配置
export interface VisChartConfig {
  type: ChartType;
  data: Record<string, any>[];
  axisXTitle?: string;
  axisYTitle?: string;
  title?: string;
  // 其他可能的配置项
  [key: string]: any;
}

// 图表类型
export type ChartType =
  | 'line'
  | 'column'
  | 'bar'
  | 'pie'
  | 'scatter'
  | 'area'
  | 'radar'
  | 'heatmap'
  | 'histogram'
  | 'treemap'
  | 'word-cloud'
  | 'network-graph'
  | 'mind-map'
  | 'flow-diagram'
  | 'funnel'
  | 'dual-axes-chart';

// 用户数据源
export interface DataSource {
  metas?: DataMeta[];
  data: Record<string, any>[];
}

// 可视化意图
export interface VisualizationIntent {
  dataSource: DataSource;
  intention?: string;
  chartType?: ChartType;
}
