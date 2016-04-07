'use strict';

System.register(['./metric_def', 'lodash', 'app/core/table_model'], function (_export, _context) {
  var metricList, unitList, _, TableModel, _createClass, KentikDatasource;

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  return {
    setters: [function (_metric_def) {
      metricList = _metric_def.metricList;
      unitList = _metric_def.unitList;
    }, function (_lodash) {
      _ = _lodash.default;
    }, function (_appCoreTable_model) {
      TableModel = _appCoreTable_model.default;
    }],
    execute: function () {
      _createClass = function () {
        function defineProperties(target, props) {
          for (var i = 0; i < props.length; i++) {
            var descriptor = props[i];
            descriptor.enumerable = descriptor.enumerable || false;
            descriptor.configurable = true;
            if ("value" in descriptor) descriptor.writable = true;
            Object.defineProperty(target, descriptor.key, descriptor);
          }
        }

        return function (Constructor, protoProps, staticProps) {
          if (protoProps) defineProperties(Constructor.prototype, protoProps);
          if (staticProps) defineProperties(Constructor, staticProps);
          return Constructor;
        };
      }();

      _export('KentikDatasource', KentikDatasource = function () {
        function KentikDatasource(instanceSettings, backendSrv, templateSrv) {
          _classCallCheck(this, KentikDatasource);

          this.instanceSettings = instanceSettings;
          this.backendSrv = backendSrv;
          this.templateSrv = templateSrv;
        }

        _createClass(KentikDatasource, [{
          key: 'interpolateDeviceField',
          value: function interpolateDeviceField(value, variable) {
            // if no multi or include all do not regexEscape
            if (!variable.multi && !variable.includeAll) {
              return value;
            }

            if (typeof value === 'string') {
              return value;
            }

            return value.join(',');
          }
        }, {
          key: 'query',
          value: function query(options) {
            if (!options.targets || options.targets.length === 0) {
              return Promise.resolve({ data: [] });
            }

            var target = options.targets[0];
            var deviceNames = this.templateSrv.replace(target.device, options.scopedVars, this.interpolateDeviceField.bind(this));

            var query = {
              version: "2.01",
              query: {
                device_name: deviceNames,
                time_type: 'fixed', // or fixed
                lookback_seconds: 3600,
                starting_time: options.range.from.utc().format("YYYY-MM-DD HH:mm:ss"),
                ending_time: options.range.to.utc().format("YYYY-MM-DD HH:mm:ss"),
                metric: this.templateSrv.replace(target.metric),
                fast_data: "Auto", // or Fast or Full
                units: this.templateSrv.replace(target.unit)
              },
              filterSettings: {
                connector: 'All',
                filterString: '',
                filterGroups: []
              }
            };

            var endpoint = 'timeSeriesData';
            if (target.mode === 'table') {
              endpoint = 'topXData';
            }

            return this.backendSrv.datasourceRequest({
              method: 'POST',
              url: 'api/plugin-proxy/kentik-app/api/v4/dataExplorer/' + endpoint,
              data: query
            }).then(this.processResponse.bind(this, query, endpoint));
          }
        }, {
          key: 'processResponse',
          value: function processResponse(query, endpoint, data) {
            if (!data.data) {
              return Promise.reject({ message: 'no kentik data' });
            }

            var rows = data.data;
            if (rows.length === 0) {
              return [];
            }

            var metricDef = _.findWhere(metricList, { value: query.query.metric });
            var unitDef = _.findWhere(unitList, { value: query.query.units });

            if (endpoint === 'topXData') {
              return this.processTopXData(rows, metricDef, unitDef);
            } else {
              return this.processTimeSeries(rows, metricDef, unitDef);
            }
          }
        }, {
          key: 'processTimeSeries',
          value: function processTimeSeries(rows, metricDef, unitDef) {
            var seriesList = {};

            for (var i = 0; i < rows.length; i++) {
              var row = rows[i];
              var value = row[unitDef.field];
              var seriesName = row[metricDef.field];
              var series = seriesList[seriesName];

              if (!series) {
                series = seriesList[seriesName] = {
                  target: seriesName,
                  datapoints: [],
                  unit: unitDef.gfUnit,
                  axisLabel: unitDef.gfAxisLabel
                };
              }

              if (unitDef.transform) {
                value = unitDef.transform(value, row);
              }

              var time = new Date(row.i_start_time).getTime();
              series.datapoints.push([value, time]);
            }

            // turn seriesList hash to array
            return { data: _.map(seriesList, function (value) {
                return value;
              }) };
          }
        }, {
          key: 'processTopXData',
          value: function processTopXData(rows, metricDef, unitDef) {
            var table = new TableModel();
            table.columns = [metricDef.text, '95th Percentile', 'Max', 'Value'];

            for (var i = 0; i < rows.length; i++) {
              var row = rows[i];
              var value = row[unitDef.field];
              var seriesName = row[metricDef.field];
              var p95th = row["p95th_both"];
              var max = row["max_both"];

              if (unitDef.transform) {
                value = unitDef.transform(value, row);
              }

              table.rows.push([seriesName, p95th, max, value]);
            }

            return { data: [table] };
          }
        }, {
          key: 'metricFindQuery',
          value: function metricFindQuery(query) {
            if (query === 'metrics()') {
              return Promise.resolve(metricList);
            }
            if (query === 'units()') {
              return Promise.resolve(unitList);
            }

            return this.backendSrv.datasourceRequest({
              method: 'GET',
              url: 'api/plugin-proxy/kentik-app/api/v1/device/list'
            }).then(function (res) {
              if (!res.data || !res.data.device) {
                return [];
              }

              return res.data.device.map(function (device) {
                return { text: device.device_name, value: device.device_name };
              });
            });
          }
        }]);

        return KentikDatasource;
      }());

      _export('KentikDatasource', KentikDatasource);
    }
  };
});
//# sourceMappingURL=datasource.js.map