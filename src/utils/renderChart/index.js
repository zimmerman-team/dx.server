import fs from "fs";
import _ from "lodash";

// execute renderChartData with passed arguments 1 2 and 3
import { chart as rawChart } from "@rawgraphs/rawgraphs-core";
import {
  alluvialdiagram,
  arcdiagram,
  barchart,
  barchartmultiset,
  barchartstacked,
  beeswarm,
  boxplot,
  bubblechart,
  bumpchart,
  circlepacking,
  circularDendrogram,
  contourPlot,
  convexHull,
  dendrogram,
  ganttChart,
  hexagonalBinning,
  horizongraph,
  linechart,
  matrixplot,
  parallelcoordinates,
  piechart,
  radarchart,
  sankeydiagram,
  slopechart,
  streamgraph,
  sunburst,
  treemap,
  violinplot,
  voronoidiagram,
  voronoitreemap,
  echartsSankey,
  echartsGeomap,
  echartsTreemap,
  echartsBarchart,
  echartsLinechart,
  bigNumber,
  // @ts-ignore
// } from "@rawgraphs/rawgraphs-charts";
} from "./rawgraphs-charts/lib/index.cjs.js";
import { __esModule } from "../../../../rawgraphs-charts/lib/index.cjs.js";

// consts
const charts = {
  alluvialdiagram,
  arcdiagram,
  barchart,
  barchartmultiset,
  barchartstacked,
  beeswarm,
  boxplot,
  bubblechart,
  bumpchart,
  // calendarHeatmap,
  circlepacking,
  circularDendrogram,
  contourPlot,
  convexHull,
  dendrogram,
  ganttChart,
  hexagonalBinning,
  horizongraph,
  linechart,
  matrixplot,
  parallelcoordinates,
  piechart,
  radarchart,
  sankeydiagram,
  slopechart,
  streamgraph,
  sunburst,
  treemap,
  violinplot,
  voronoidiagram,
  voronoitreemap,
  echartsSankey,
  echartsGeomap,
  echartsTreemap,
  echartsBarchart,
  echartsLinechart,
  bigNumber,
};

// utils
function getDatasetFilterOptions(
  dataset,
  onlyKeys,
) {
  const filterOptions = [];
  if (!dataset || dataset.length === 0) {
    return filterOptions;
  }
  const itemKeys = _.filter(Object.keys(dataset[0]), (key) => {
    return (
      key !== "id" &&
      !key.toLowerCase().includes("amount") &&
      !key.toLowerCase().includes("date") &&
      !key.toLowerCase().includes("number") &&
      !key.toLowerCase().includes("title")
    );
  });

  if (onlyKeys) return itemKeys;

  itemKeys.forEach((key) => {
    const options = _.filter(
      Object.keys(_.groupBy(dataset, key)),
      (optionKey) =>
        optionKey !== "undefined" && optionKey !== "null" && optionKey !== ""
    );
    const name = key;

    if (options.length > 0) {
      filterOptions.push({
        name,
        enabled: true,
        options: _.orderBy(
          _.uniq(options).map((o) => ({
            label: o,
            value: o,
          })),
          "label",
          "asc"
        ),
      });
    }
  });

  return filterOptions;
}

function filterData(
  data,
  appliedFilters
) {
  // Get the filter keys
  const filterKeys = Object.keys(appliedFilters || {});
  if (filterKeys.length === 0) return data; // can't be 0, but safety return
  
  // Filter 'data' based on 'appliedFilters' using the specified 'filterKeys'
  const filteredData = _.filter(data, (item) => {
    // Check if all conditions hold for each 'filterKey'
    return filterKeys.every((filterKey) =>
      appliedFilters[filterKey]?.includes(item[filterKey]?.toString())
    );
  });

  return filteredData;
}

function renderChart(
  item,
  parsed,
  id,
  itemAppliedFilters,
  vizType
) {
  const chart = charts[vizType];
  const viz = rawChart(chart, {
    data: parsed.dataset,
    mapping: item.mapping,
    visualOptions: item.vizOptions,
    dataTypes: parsed.dataTypes,
  });
  const vizData = viz._getVizData();

  let tabItem = {
    renderedContent: "",
    appliedFilters: itemAppliedFilters || item.appliedFilters,
    filterOptionGroups: getDatasetFilterOptions(
      parsed.dataset
    ),
    enabledFilterOptionGroups:
      item.enabledFilterOptionGroups,
    dataTypes: parsed.dataTypes,
    mappedData: vizData,
    dimensions: chart.dimensions,
    ssr: false,
  };
  if (id !== "new") {
    tabItem = {
      ...tabItem,
      mapping: item.mapping,
      vizType: item.vizType,
      datasetId: item.datasetId,
      vizOptions: item.vizOptions,
    };
  }
  return tabItem;
}

export async function renderChartData(id, body, chartData) {
  let data;
  if (id === "new" || body.rows) {
    if (!body.rows || body.rows.length === 0) {
      return { "error": "no rows"};
    } 
    data = body.rows;
  } else {
    data = [[chartData]];
  }

  // at this point, this render function is always used to render a single chart.
  // we can assume that we only take the data item at data[0][0].
  // content is never in item anymore.
  // read the item and get the relevant parsed-data-file as json
  let item = data[0][0];
  let parsed = null;
  try {
    const parsedData = fs.readFileSync(`/home/zimmerman/Projects/dx/DX/dx.rawgraphs-ssr/parsed-data-files/${item.datasetId}.json`)
    parsed = JSON.parse(parsedData.toString());
  } catch (error) {
    console.error(`Error loading parsed data`, error);
  }

  // Check if there are either filters in the item.appliedFilters or in the body.previewAppliedFilters
  const itemAppliedFilters = _.get(body, `previewAppliedFilters[0][0]`, null);
  // If there are filters, filter the data
  if (!_.isEmpty(item.appliedFilters) || itemAppliedFilters) {
    parsed.dataset = filterData(parsed.dataset, itemAppliedFilters || item.appliedFilters);
  }

  // render the chart
  const renderedChart = renderChart(item, parsed, id, itemAppliedFilters, item.vizType);
  // Return the rendered chart item
  // json stringify and save to ./rendered.json
  fs.writeFileSync(`${__dirname}/rendering/${id}_rendered.json`, JSON.stringify(renderedChart))
  console.log("Success...")
};

try {
  // if argv2 is undefined, return error
  if (process.argv[2] === undefined) {
      console.error("No id provided");
  } else {
      // read the first argument as id
      const id = process.argv[2]  // 2 because 0 is node and 1 is this file
      // read the data from ./source_data.json as json
      const data = fs.readFileSync(`${__dirname}/rendering/${id}.json`)
      const parsedData = JSON.parse(data.toString());
      const body = parsedData.body
      const chartData = parsedData.chartData
      renderChartData(id, body, chartData)
  }
} catch (error) {
  console.error("Something went wrong...\n", error)
}