
    "jsonrpc":  "2.0",
    "id":  1,
    "result":  {
                   "tools":  [
                                 {
                                     "name":  "adaptive-anomaly-detector",
                                     "title":  "Autoadaptive Threshold Analysis Agent",
                                     "description":  "Detects anomalies in time series data by learning a single threshold from the data distribution that separates outliers from normal observations.\nTimeframe for analysis should never be set in the future.\nIt is advisable to use the create-dql tool beforehand to get a valid DQL query as input for this tool.\n",
                                     "inputSchema":  {
                                                         "type":  "object",
                                                         "properties":  {
                                                                            "generalParameters":  {
                                                                                                      "title":  "General parameters",
                                                                                                      "description":  "General query parameter",
                                                                                                      "type":  "object",
                                                                                                      "additionalProperties":  true,
                                                                                                      "properties":  {
                                                                                                                         "timeframe":  {
                                                                                                                                           "title":  "Timeframe",
                                                                                                                                           "description":  "By default, the general timeframe for queries is the last 2 hours from now. If only a startTime is provided, the current time will be used as the endTime.",
                                                                                                                                           "type":  "object",
                                                                                                                                           "additionalProperties":  false,
                                                                                                                                           "properties":  {
                                                                                                                                                              "startTime":  {
                                                                                                                                                                                "title":  "Start time",
                                                                                                                                                                                "description":  "Supports absolute or relative timestamps. Specify an absolute time in the ISO 8601 (yyyy-MM-ddTHH:mm:ssZ) format or use a relative time such as \u0027now-2h\u0027. For relative timestamps only hours, minutes and days are allowed and are abbreviated as h, m and d respectively. Only lowercase input is accepted.",
                                                                                                                                                                                "type":  "string",
                                                                                                                                                                                "examples":  [
                                                                                                                                                                                                 "2023-04-10T12:00Z",
                                                                                                                                                                                                 "now-2h"
                                                                                                                                                                                             ],
                                                                                                                                                                                "default":  "now-2h"
                                                                                                                                                                            },
                                                                                                                                                              "endTime":  {
                                                                                                                                                                              "title":  "End time",
                                                                                                                                                                              "type":  "string",
                                                                                                                                                                              "examples":  [
                                                                                                                                                                                               "2023-04-12T12:00Z",
                                                                                                                                                                                               "now"
                                                                                                                                                                                           ],
                                                                                                                                                                              "default":  "now"
                                                                                                                                                                          }
                                                                                                                                                          },
                                                                                                                                           "required":  [
                                                                                                                                                            "startTime"
                                                                                                                                                        ]
                                                                                                                                       }
                                                                                                                     }
                                                                                                  },
                                                                            "timeSeriesData":  {
                                                                                                   "title":  "Time series data",
                                                                                                   "description":  "Time series data or query to analyze. Supports the Dynatrace Query Language (DQL).",
                                                                                                   "oneOf":  [
                                                                                                                 {
                                                                                                                     "type":  "string"
                                                                                                                 },
                                                                                                                 {
                                                                                                                     "type":  "object"
                                                                                                                 }
                                                                                                             ]
                                                                                               },
                                                                            "numberOfSignalFluctuations":  {
                                                                                                               "title":  "Number of signal fluctuations",
                                                                                                               "description":  "Controls how many times the signal fluctuation is added to the baseline to produce the actual threshold for alerting. Value must be between 0.0 and 10.0. The default value is 1.0.",
                                                                                                               "type":  "number"
                                                                                                           },
                                                                            "alertCondition":  {
                                                                                                   "title":  "Alert condition",
                                                                                                   "type":  "string",
                                                                                                   "anyOf":  [
                                                                                                                 {
                                                                                                                     "title":  "Alert if metric is below",
                                                                                                                     "description":  "Alert only if values are below a threshold.",
                                                                                                                     "enum":  [
                                                                                                                                  "BELOW"
                                                                                                                              ]
                                                                                                                 },
                                                                                                                 {
                                                                                                                     "title":  "Alert if metric is above",
                                                                                                                     "description":  "Alert only if values are above a threshold.",
                                                                                                                     "enum":  [
                                                                                                                                  "ABOVE"
                                                                                                                              ]
                                                                                                                 },
                                                                                                                 {
                                                                                                                     "title":  "Alert if metric is outside",
                                                                                                                     "description":  "Alert if values are above or below a threshold.",
                                                                                                                     "enum":  [
                                                                                                                                  "OUTSIDE"
                                                                                                                              ]
                                                                                                                 }
                                                                                                             ]
                                                                                               },
                                                                            "alertOnMissingData":  {
                                                                                                       "title":  "Alert on missing data",
                                                                                                       "description":  "The ability to set an alert on missing data in a metric. When enabled, missing data samples will be treated as violating samples. When disabled, missing data is not treated as a violation but will still contribute to dealerting. We recommend disabling alerting on missing data for sparse timeseries to avoid false alerts. To learn more, visit [anomaly detection configuration](https://dt-url.net/lz02mwi).",
                                                                                                       "type":  "boolean"
                                                                                                   },
                                                                            "violatingSamples":  {
                                                                                                     "title":  "Violating samples",
                                                                                                     "description":  "Total number of samples in the sliding window that must violate to trigger an event. Value must be between 1 and 60. The default value is 3.",
                                                                                                     "type":  "integer"
                                                                                                 },
                                                                            "slidingWindow":  {
                                                                                                  "title":  "Sliding window",
                                                                                                  "description":  "Total number of samples that form the sliding window. Value must be between 1 and 60. The default value is 5.",
                                                                                                  "type":  "integer"
                                                                                              },
                                                                            "dealertingSamples":  {
                                                                                                      "title":  "Dealerting samples",
                                                                                                      "description":  "Total number of samples in the sliding window that must go back to normal to close the event. Value must be between 1 and 60. The default value is 5.",
                                                                                                      "type":  "integer"
                                                                                                  }
                                                                        },
                                                         "required":  [
                                                                          "timeSeriesData",
                                                                          "numberOfSignalFluctuations"
                                                                      ],
                                                         "additionalProperties":  false
                                                     },
                                     "outputSchema":  {
                                                          "title":  "Result for Auto adaptive threshold anomaly detection",
                                                          "$schema":  "http://json-schema.org/draft-07/schema#",
                                                          "description":  "[Learn more](https://dt-url.net/t123bwy)",
                                                          "type":  "object",
                                                          "additionalProperties":  false,
                                                          "required":  [
                                                                           "resultStatus",
                                                                           "executionStatus",
                                                                           "resultId",
                                                                           "output"
                                                                       ],
                                                          "properties":  {
                                                                             "resultStatus":  {
                                                                                                  "title":  "resultStatus",
                                                                                                  "type":  "string",
                                                                                                  "anyOf":  [
                                                                                                                {
                                                                                                                    "title":  "Successful",
                                                                                                                    "description":  "Successful result",
                                                                                                                    "enum":  [
                                                                                                                                 "SUCCESSFUL"
                                                                                                                             ]
                                                                                                                },
                                                                                                                {
                                                                                                                    "title":  "Successful with warnings",
                                                                                                                    "description":  "Successful result contains warnings",
                                                                                                                    "enum":  [
                                                                                                                                 "SUCCESSFUL_WITH_WARNINGS"
                                                                                                                             ]
                                                                                                                },
                                                                                                                {
                                                                                                                    "title":  "Failed",
                                                                                                                    "description":  "Failed result",
                                                                                                                    "enum":  [
                                                                                                                                 "FAILED"
                                                                                                                             ]
                                                                                                                }
                                                                                                            ]
                                                                                              },
                                                                             "executionStatus":  {
                                                                                                     "title":  "executionStatus",
                                                                                                     "type":  "string",
                                                                                                     "anyOf":  [
                                                                                                                   {
                                                                                                                       "title":  "Running",
                                                                                                                       "description":  "Execution still running",
                                                                                                                       "enum":  [
                                                                                                                                    "RUNNING"
                                                                                                                                ]
                                                                                                                   },
                                                                                                                   {
                                                                                                                       "title":  "Aborted",
                                                                                                                       "description":  "Execution manually canceled",
                                                                                                                       "enum":  [
                                                                                                                                    "ABORTED"
                                                                                                                                ]
                                                                                                                   },
                                                                                                                   {
                                                                                                                       "title":  "Completed",
                                                                                                                       "description":  "Execution completed",
                                                                                                                       "enum":  [
                                                                                                                                    "COMPLETED"
                                                                                                                                ]
                                                                                                                   }
                                                                                                               ]
                                                                                                 },
                                                                             "resultId":  {
                                                                                              "title":  "resultId",
                                                                                              "type":  "string"
                                                                                          },
                                                                             "input":  {
                                                                                           "type":  "object"
                                                                                       },
                                                                             "output":  {
                                                                                            "type":  "array",
                                                                                            "items":  {
                                                                                                          "type":  "object",
                                                                                                          "additionalProperties":  false,
                                                                                                          "required":  [
                                                                                                                           "analysisStatus",
                                                                                                                           "analyzedTimeSeriesQuery"
                                                                                                                       ],
                                                                                                          "properties":  {
                                                                                                                             "system":  {
                                                                                                                                            "title":  "System",
                                                                                                                                            "description":  "Output system parameters",
                                                                                                                                            "type":  "object",
                                                                                                                                            "additionalProperties":  false,
                                                                                                                                            "properties":  {
                                                                                                                                                               "logs":  {
                                                                                                                                                                            "title":  "Logs",
                                                                                                                                                                            "description":  "Logs connected to a specific output",
                                                                                                                                                                            "type":  "array",
                                                                                                                                                                            "items":  {
                                                                                                                                                                                          "type":  "object",
                                                                                                                                                                                          "additionalProperties":  false,
                                                                                                                                                                                          "required":  [
                                                                                                                                                                                                           "level",
                                                                                                                                                                                                           "message"
                                                                                                                                                                                                       ],
                                                                                                                                                                                          "properties":  {
                                                                                                                                                                                                             "level":  {
                                                                                                                                                                                                                           "title":  "Level",
                                                                                                                                                                                                                           "type":  "string",
                                                                                                                                                                                                                           "anyOf":  [
                                                                                                                                                                                                                                         {
                                                                                                                                                                                                                                             "title":  "Tracing",
                                                                                                                                                                                                                                             "description":  "Tracing",
                                                                                                                                                                                                                                             "enum":  [
                                                                                                                                                                                                                                                          "TRACING"
                                                                                                                                                                                                                                                      ]
                                                                                                                                                                                                                                         },
                                                                                                                                                                                                                                         {
                                                                                                                                                                                                                                             "title":  "Info",
                                                                                                                                                                                                                                             "description":  "Info",
                                                                                                                                                                                                                                             "enum":  [
                                                                                                                                                                                                                                                          "INFO"
                                                                                                                                                                                                                                                      ]
                                                                                                                                                                                                                                         },
                                                                                                                                                                                                                                         {
                                                                                                                                                                                                                                             "title":  "Warning",
                                                                                                                                                                                                                                             "description":  "Warning",
                                                                                                                                                                                                                                             "enum":  [
                                                                                                                                                                                                                                                          "WARNING"
                                                                                                                                                                                                                                                      ]
                                                                                                                                                                                                                                         }
                                                                                                                                                                                                                                     ]
                                                                                                                                                                                                                       },
                                                                                                                                                                                                             "message":  {
                                                                                                                                                                                                                             "title":  "Message",
                                                                                                                                                                                                                             "type":  "string"
                                                                                                                                                                                                                         }
                                                                                                                                                                                                         }
                                                                                                                                                                                      }
                                                                                                                                                                        }
                                                                                                                                                           }
                                                                                                                                        },
                                                                                                                             "analysisStatus":  {
                                                                                                                                                    "title":  "The status of an analysis",
                                                                                                                                                    "description":  "The status of an analysis of a particular univariate data.",
                                                                                                                                                    "type":  "string",
                                                                                                                                                    "anyOf":  [
                                                                                                                                                                  {
                                                                                                                                                                      "title":  "OK",
                                                                                                                                                                      "description":  "The analysis was performed successfully, the result is available.",
                                                                                                                                                                      "enum":  [
                                                                                                                                                                                   "OK"
                                                                                                                                                                               ]
                                                                                                                                                                  },
                                                                                                                                                                  {
                                                                                                                                                                      "title":  "Failed",
                                                                                                                                                                      "description":  "There was a problem during an analysis, the result is not available.",
                                                                                                                                                                      "enum":  [
                                                                                                                                                                                   "FAILED"
                                                                                                                                                                               ]
                                                                                                                                                                  }
                                                                                                                                                              ]
                                                                                                                                                },
                                                                                                                             "analyzedTimeSeriesQuery":  {
                                                                                                                                                             "title":  "Analyzed time series query",
                                                                                                                                                             "description":  "Time series query that corresponds to the analyzed univariate data.",
                                                                                                                                                             "oneOf":  [
                                                                                                                                                                           {
                                                                                                                                                                               "type":  "string"
                                                                                                                                                                           },
                                                                                                                                                                           {
                                                                                                                                                                               "type":  "object"
                                                                                                                                                                           }
                                                                                                                                                                       ]
                                                                                                                                                         },
                                                                                                                             "anomalyDetectorBounds":  {
                                                                                                                                                           "title":  "Bounds of anomaly detector",
                                                                                                                                                           "description":  "Bounds of anomaly detector in order to count a value as an anomaly. The bounds are reported as a multivariate time series data array with properties {dt.davis.anomaly_detection: lower}, {dt.davis.anomaly_detection: upper} or both on the respective columns.",
                                                                                                                                                           "type":  "object"
                                                                                                                                                       },
                                                                                                                             "raisedAlerts":  {
                                                                                                                                                  "title":  "Raised alerts",
                                                                                                                                                  "description":  "List of raised alerts found within the evaluation time frame",
                                                                                                                                                  "type":  "array",
                                                                                                                                                  "items":  {
                                                                                                                                                                "type":  "object",
                                                                                                                                                                "additionalProperties":  false,
                                                                                                                                                                "required":  [
                                                                                                                                                                                 "timeframe",
                                                                                                                                                                                 "numberOfViolations"
                                                                                                                                                                             ],
                                                                                                                                                                "properties":  {
                                                                                                                                                                                   "timeframe":  {
                                                                                                                                                                                                     "title":  "Timeframe",
                                                                                                                                                                                                     "description":  "Represents the start and end time of an alert, given in ms. If only a startTime is provided, the current time will be used as the endTime.",
                                                                                                                                                                                                     "type":  "object",
                                                                                                                                                                                                     "additionalProperties":  false,
                                                                                                                                                                                                     "properties":  {
                                                                                                                                                                                                                        "startTime":  {
                                                                                                                                                                                                                                          "title":  "Start time",
                                                                                                                                                                                                                                          "description":  "Supports absolute or relative timestamps. Specify an absolute time in the ISO 8601 (yyyy-MM-ddTHH:mm:ssZ) format or use a relative time such as \u0027now-2h\u0027. For relative timestamps only hours, minutes and days are allowed and are abbreviated as h, m and d respectively. Only lowercase input is accepted.",
                                                                                                                                                                                                                                          "type":  "string",
                                                                                                                                                                                                                                          "examples":  [
                                                                                                                                                                                                                                                           "2023-04-10T12:00Z",
                                                                                                                                                                                                                                                           "now-2h"
                                                                                                                                                                                                                                                       ]
                                                                                                                                                                                                                                      },
                                                                                                                                                                                                                        "endTime":  {
                                                                                                                                                                                                                                        "title":  "End time",
                                                                                                                                                                                                                                        "type":  "string",
                                                                                                                                                                                                                                        "examples":  [
                                                                                                                                                                                                                                                         "2023-04-12T12:00Z",
                                                                                                                                                                                                                                                         "now"
                                                                                                                                                                                                                                                     ]
                                                                                                                                                                                                                                    }
                                                                                                                                                                                                                    },
                                                                                                                                                                                                     "required":  [
                                                                                                                                                                                                                      "startTime"
                                                                                                                                                                                                                  ]
                                                                                                                                                                                                 },
                                                                                                                                                                                   "numberOfViolations":  {
                                                                                                                                                                                                              "title":  "Number of violations",
                                                                                                                                                                                                              "description":  "Number of violations (anomalies) within an alert",
                                                                                                                                                                                                              "type":  "integer"
                                                                                                                                                                                                          },
                                                                                                                                                                                   "properties":  {
                                                                                                                                                                                                      "title":  "Properties",
                                                                                                                                                                                                      "description":  "List of properties describing in more detail given raised alert.",
                                                                                                                                                                                                      "type":  "array",
                                                                                                                                                                                                      "items":  {
                                                                                                                                                                                                                    "type":  "object",
                                                                                                                                                                                                                    "additionalProperties":  false,
                                                                                                                                                                                                                    "required":  [
                                                                                                                                                                                                                                     "key",
                                                                                                                                                                                                                                     "value"
                                                                                                                                                                                                                                 ],
                                                                                                                                                                                                                    "properties":  {
                                                                                                                                                                                                                                       "key":  {
                                                                                                                                                                                                                                                   "title":  "Key",
                                                                                                                                                                                                                                                   "description":  "Key of the property",
                                                                                                                                                                                                                                                   "type":  "string"
                                                                                                                                                                                                                                               },
                                                                                                                                                                                                                                       "value":  {
                                                                                                                                                                                                                                                     "title":  "Value",
                                                                                                                                                                                                                                                     "description":  "Value of the property",
                                                                                                                                                                                                                                                     "type":  "string"
                                                                                                                                                                                                                                                 }
                                                                                                                                                                                                                                   }
                                                                                                                                                                                                                }
                                                                                                                                                                                                  }
                                                                                                                                                                               }
                                                                                                                                                            }
                                                                                                                                              },
                                                                                                                             "dimensions":  {
                                                                                                                                                "title":  "Dimensions",
                                                                                                                                                "description":  "Dimension-tuples of the underlying time series",
                                                                                                                                                "type":  "array",
                                                                                                                                                "items":  {
                                                                                                                                                              "type":  "object",
                                                                                                                                                              "additionalProperties":  false,
                                                                                                                                                              "required":  [
                                                                                                                                                                               "key",
                                                                                                                                                                               "value"
                                                                                                                                                                           ],
                                                                                                                                                              "properties":  {
                                                                                                                                                                                 "key":  {
                                                                                                                                                                                             "title":  "Key",
                                                                                                                                                                                             "description":  "Key of the dimension",
                                                                                                                                                                                             "type":  "string"
                                                                                                                                                                                         },
                                                                                                                                                                                 "value":  {
                                                                                                                                                                                               "title":  "Value",
                                                                                                                                                                                               "description":  "Value of the dimension",
                                                                                                                                                                                               "type":  "string"
                                                                                                                                                                                           }
                                                                                                                                                                             }
                                                                                                                                                          }
                                                                                                                                            }
                                                                                                                         }
                                                                                                      }
                                                                                        },
                                                                             "logs":  {
                                                                                          "type":  "array",
                                                                                          "items":  {
                                                                                                        "level":  {
                                                                                                                      "title":  "level",
                                                                                                                      "type":  "string",
                                                                                                                      "anyOf":  [
                                                                                                                                    {
                                                                                                                                        "title":  "Tracing",
                                                                                                                                        "description":  "Tracing",
                                                                                                                                        "enum":  [
                                                                                                                                                     "TRACING"
                                                                                                                                                 ]
                                                                                                                                    },
                                                                                                                                    {
                                                                                                                                        "title":  "Info",
                                                                                                                                        "description":  "Info",
                                                                                                                                        "enum":  [
                                                                                                                                                     "INFO"
                                                                                                                                                 ]
                                                                                                                                    },
                                                                                                                                    {
                                                                                                                                        "title":  "Warning",
                                                                                                                                        "description":  "Warning",
                                                                                                                                        "enum":  [
                                                                                                                                                     "WARNING"
                                                                                                                                                 ]
                                                                                                                                    },
                                                                                                                                    {
                                                                                                                                        "title":  "Severe",
                                                                                                                                        "description":  "Severe",
                                                                                                                                        "enum":  [
                                                                                                                                                     "SEVERE"
                                                                                                                                                 ]
                                                                                                                                    }
                                                                                                                                ]
                                                                                                                  },
                                                                                                        "message":  {
                                                                                                                        "title":  "message",
                                                                                                                        "type":  "string"
                                                                                                                    },
                                                                                                        "analyzerName":  {
                                                                                                                             "title":  "analyzerName",
                                                                                                                             "type":  "string"
                                                                                                                         }
                                                                                                    }
                                                                                      },
                                                                             "data":  {
                                                                                          "type":  "array",
                                                                                          "items":  {
                                                                                                        "type":  "object",
                                                                                                        "required":  [
                                                                                                                         "query",
                                                                                                                         "value",
                                                                                                                         "type"
                                                                                                                     ],
                                                                                                        "properties":  {
                                                                                                                           "query":  {
                                                                                                                                         "oneOf":  [
                                                                                                                                                       {
                                                                                                                                                           "type":  "string"
                                                                                                                                                       },
                                                                                                                                                       {
                                                                                                                                                           "type":  "object"
                                                                                                                                                       }
                                                                                                                                                   ]
                                                                                                                                     },
                                                                                                                           "value":  {
                                                                                                                                         "type":  "object"
                                                                                                                                     },
                                                                                                                           "type":  {
                                                                                                                                        "type":  "string"
                                                                                                                                    }
                                                                                                                       }
                                                                                                    }
                                                                                      }
                                                                         }
                                                      },
                                     "annotations":  {
                                                         "title":  "Autoadaptive Threshold Analysis Agent",
                                                         "readOnlyHint":  true,
                                                         "destructiveHint":  false,
                                                         "idempotentHint":  false,
                                                         "openWorldHint":  false,
                                                         "returnDirect":  true
                                                     },
                                     "_meta":  {
                                                   "customerFacingDescription":  "Identify anomalies automatically by learning a single smart threshold from your historical data. Works best when Grail Query Agent is also enabled"
                                               }
                                 },
                                 {
                                     "name":  "ask-dynatrace-docs",
                                     "title":  "Help Agent",
                                     "description":  "Dynatrace documentation bot. Answers questions about Dynatrace documentation and the Dynatrace product.\nAlways use this tool when answering questions about Dynatrace and related terminology like grail, oneagent, smartscape, piepleine, SLO, SLA.\nAlso use for questions about general observability and monitoring or open source or third-party technologies (e.g., CouchDB, openpipeline) if they relate to software development, observability, integration with Dynatrace, or are common in the industry context.\n",
                                     "inputSchema":  {
                                                         "type":  "object",
                                                         "properties":  {
                                                                            "prompt":  {
                                                                                           "type":  "string",
                                                                                           "description":  "An LLM/Chat prompt about anything technology/dynatrace related. Up to 10_000 characters"
                                                                                       }
                                                                        },
                                                         "required":  [
                                                                          "prompt"
                                                                      ],
                                                         "additionalProperties":  false
                                                     },
                                     "outputSchema":  {
                                                          "description":  "Result of asking a question about the Dynatrace documentation, blogs, community, ...",
                                                          "properties":  {
                                                                             "text":  {
                                                                                          "description":  "The answer to the question.",
                                                                                          "type":  "string",
                                                                                          "contentMediaType":  "text/markdown"
                                                                                      },
                                                                             "metadata":  {
                                                                                              "description":  "Additional information about the answer.",
                                                                                              "type":  "object",
                                                                                              "properties":  {
                                                                                                                 "sources":  {
                                                                                                                                 "type":  "array",
                                                                                                                                 "description":  "Sources used to answer this the question.",
                                                                                                                                 "items":  {
                                                                                                                                               "type":  "object",
                                                                                                                                               "properties":  {
                                                                                                                                                                  "title":  {
                                                                                                                                                                                "description":  "The title of the source.",
                                                                                                                                                                                "type":  "string"
                                                                                                                                                                            },
                                                                                                                                                                  "url":  {
                                                                                                                                                                              "description":  "The URL of the source.",
                                                                                                                                                                              "type":  "string"
                                                                                                                                                                          },
                                                                                                                                                                  "type":  {
                                                                                                                                                                               "description":  "The type/category of the source, e.g. \u0027doc\u0027, \u0027blog\u0027, \u0027community\u0027, ...",
                                                                                                                                                                               "type":  "string"
                                                                                                                                                                           }
                                                                                                                                                              }
                                                                                                                                           }
                                                                                                                             }
                                                                                                             },
                                                                                              "required":  [
                                                                                                               "sources"
                                                                                                           ]
                                                                                          }
                                                                         },
                                                          "required":  [
                                                                           "text",
                                                                           "metadata"
                                                                       ],
                                                          "title":  "Ask-Dynatrace-Docs Response",
                                                          "type":  "object",
                                                          "x-content-type":  "application/x-dynatrace-retriever-result"
                                                      },
                                     "annotations":  {
                                                         "title":  "Help Agent",
                                                         "readOnlyHint":  true,
                                                         "destructiveHint":  false,
                                                         "idempotentHint":  false,
                                                         "openWorldHint":  false,
                                                         "returnDirect":  true
                                                     },
                                     "_meta":  {
                                                   "customerFacingDescription":  "Get clear, expert answers to anything about Dynatrace, observability, monitoring, and industryâstandard technologies, powered directly by Dynatraceâs official documentation."
                                               }
                                 },
                                 {
                                     "name":  "create-dql",
                                     "title":  "Grail Query Agent",
                                     "description":  "Generate optimized Dynatrace Query Language (DQL) queries from natural language descriptions.\nUse this tool as your primary method for converting any data retrieval request into DQL syntax before executing with execute-dql or passing to analysis tools.\nSupports all DQL operations: fetching logs, spans, traces, metrics, timeseries data, and complex aggregations.\nThis tool CAN  NOT generate any queries that perform statistical data analysis like forecasts, anomaly detection, timeseries characteristic or others. It only creates queries to fetch historic values which can be used as input to analyzer tools if needed.\nUses \"Grail\" database as source to be called with generated queries.\n",
                                     "inputSchema":  {
                                                         "type":  "object",
                                                         "properties":  {
                                                                            "request":  {
                                                                                            "type":  "string",
                                                                                            "description":  "A natural language description of what data should be retrieved from the Database, e.g. logs, spans, traces, metrics, etc."
                                                                                        }
                                                                        },
                                                         "required":  [
                                                                          "request"
                                                                      ],
                                                         "additionalProperties":  false
                                                     },
                                     "outputSchema":  {
                                                          "description":  "Result of creating a DQL query from a natural language question.",
                                                          "properties":  {
                                                                             "dql":  {
                                                                                         "description":  "A DQL query (dynatrace query language).",
                                                                                         "type":  "string",
                                                                                         "contentMediaType":  "application/x-dql"
                                                                                     }
                                                                         },
                                                          "required":  [
                                                                           "dql"
                                                                       ],
                                                          "title":  "Create-DQL Response",
                                                          "type":  "object",
                                                          "x-content-type":  "application/x-dql-creation-result"
                                                      },
                                     "annotations":  {
                                                         "title":  "Grail Query Agent",
                                                         "readOnlyHint":  true,
                                                         "destructiveHint":  false,
                                                         "idempotentHint":  false,
                                                         "openWorldHint":  false,
                                                         "returnDirect":  true
                                                     },
                                     "_meta":  {
                                                   "customerFacingDescription":  "Turn plain natural language requests into precise Dynatrace DQL queries for Grail."
                                               }
                                 },
                                 {
                                     "name":  "execute-dql",
                                     "title":  "Data Analysis Agent",
                                     "description":  "Execute DQL dql query string and returns the result.",
                                     "inputSchema":  {
                                                         "type":  "object",
                                                         "properties":  {
                                                                            "includeTypes":  {
                                                                                                 "type":  "boolean",
                                                                                                 "description":  "If true the DQL query result types will be included in the result. Default value is true."
                                                                                             },
                                                                            "dqlQueryString":  {
                                                                                                   "contentMediaType":  "application/x-dql",
                                                                                                   "description":  "the dql query string to execute",
                                                                                                   "type":  "string"
                                                                                               }
                                                                        },
                                                         "required":  [
                                                                          "dqlQueryString"
                                                                      ],
                                                         "additionalProperties":  false
                                                     },
                                     "outputSchema":  {
                                                          "description":  "Result of executing a DQL query against Dynatrace Grail",
                                                          "properties":  {
                                                                             "records":  {
                                                                                             "description":  "The records returned by the DQL query.",
                                                                                             "type":  "array",
                                                                                             "items":  {
                                                                                                           "additionalProperties":  true,
                                                                                                           "type":  "object"
                                                                                                       }
                                                                                         },
                                                                             "types":  {
                                                                                           "description":  "The types for the records returned by the DQL query.",
                                                                                           "type":  "array",
                                                                                           "items":  {
                                                                                                         "additionalProperties":  true,
                                                                                                         "type":  "object"
                                                                                                     },
                                                                                           "annotations":  {
                                                                                                               "audience":  [
                                                                                                                                "user"
                                                                                                                            ]
                                                                                                           }
                                                                                       },
                                                                             "metadata":  {
                                                                                              "description":  "Metadata about the query execution and results from Grail",
                                                                                              "type":  "object",
                                                                                              "annotations":  {
                                                                                                                  "audience":  [
                                                                                                                                   "user"
                                                                                                                               ]
                                                                                                              }
                                                                                          }
                                                                         },
                                                          "required":  [
                                                                           "records"
                                                                       ],
                                                          "title":  "Grail DQL Query Result",
                                                          "type":  "object",
                                                          "x-content-type":  "application/x-grail-query-result"
                                                      },
                                     "annotations":  {
                                                         "title":  "Data Analysis Agent",
                                                         "readOnlyHint":  true,
                                                         "destructiveHint":  false,
                                                         "idempotentHint":  false,
                                                         "openWorldHint":  false,
                                                         "returnDirect":  true
                                                     },
                                     "_meta":  {
                                                   "ui":  {
                                                              "resourceUri":  "ui://visualizeGrailResults.html"
                                                          },
                                                   "customerFacingDescription":  "Run any DQL query directly and get real time insights into Dynatrace data."
                                               }
                                 },
                                 {
                                     "name":  "explain-dql",
                                     "title":  "DQL Explanation Agent",
                                     "description":  "Get a natural text explanation of a DQL (\u0027Dynatrace query language\u0027). Only call this when your input is a DQL, e.g. \"fetch logs\" or \"timeseries avg(dt.host.cpu.usage)\"",
                                     "inputSchema":  {
                                                         "type":  "object",
                                                         "properties":  {
                                                                            "dql":  {
                                                                                        "contentMediaType":  "application/x-dql",
                                                                                        "description":  "A Dynatrace DQL query which should be explained",
                                                                                        "type":  "string"
                                                                                    }
                                                                        },
                                                         "required":  [
                                                                          "dql"
                                                                      ],
                                                         "additionalProperties":  false
                                                     },
                                     "outputSchema":  {
                                                          "description":  "Result of getting a DQL query explained.",
                                                          "properties":  {
                                                                             "summary":  {
                                                                                             "description":  "A short summary of the query.",
                                                                                             "type":  "string",
                                                                                             "contentMediaType":  "text/markdown"
                                                                                         },
                                                                             "explanation":  {
                                                                                                 "description":  "A detailed, step-by-step explanation of the query.",
                                                                                                 "type":  "string",
                                                                                                 "contentMediaType":  "text/markdown"
                                                                                             }
                                                                         },
                                                          "required":  [
                                                                           "summary",
                                                                           "explanation"
                                                                       ],
                                                          "title":  "Explain-DQL Response",
                                                          "type":  "object",
                                                          "x-content-type":  "application/x-dql-explanation"
                                                      },
                                     "annotations":  {
                                                         "title":  "DQL Explanation Agent",
                                                         "readOnlyHint":  true,
                                                         "destructiveHint":  false,
                                                         "idempotentHint":  false,
                                                         "openWorldHint":  false,
                                                         "returnDirect":  true
                                                     },
                                     "_meta":  {
                                                   "customerFacingDescription":  "Understand what any DQL query does with clear, humanâreadable explanations that translate syntax into meaning."
                                               }
                                 },
                                 {
                                     "name":  "find-documents",
                                     "title":  "Document Agent",
                                     "description":  "Searches across all Dashboards and Notebooks in the Dynatrace platform\nto find relevant documents where the title contains a specific search string.\n",
                                     "inputSchema":  {
                                                         "type":  "object",
                                                         "properties":  {
                                                                            "searchString":  {
                                                                                                 "type":  "string",
                                                                                                 "description":  "Search string to match against document titles.\nThe document title must contain this text exactly as given (spaces and punctuation included).\nNo fuzzy matching or partial token matching is applied.\nMatching is case-insensitive.\n"
                                                                                             }
                                                                        },
                                                         "required":  [
                                                                          "searchString"
                                                                      ],
                                                         "additionalProperties":  false
                                                     },
                                     "outputSchema":  {
                                                          "description":  "List of documents where the name contains the searchString",
                                                          "title":  "Find documents result",
                                                          "type":  "object",
                                                          "properties":  {
                                                                             "documents":  {
                                                                                               "type":  "array",
                                                                                               "description":  "List of documents where the name contains the searchString",
                                                                                               "items":  {
                                                                                                             "required":  [
                                                                                                                              "id",
                                                                                                                              "name",
                                                                                                                              "type"
                                                                                                                          ],
                                                                                                             "type":  "object",
                                                                                                             "properties":  {
                                                                                                                                "id":  {
                                                                                                                                           "description":  "The unique identified of the document",
                                                                                                                                           "type":  "string"
                                                                                                                                       },
                                                                                                                                "name":  {
                                                                                                                                             "description":  "Human friendly name of the document",
                                                                                                                                             "type":  "string"
                                                                                                                                         },
                                                                                                                                "type":  {
                                                                                                                                             "description":  "Document type. For example Notebook or Dashboard",
                                                                                                                                             "type":  "string"
                                                                                                                                         }
                                                                                                                            }
                                                                                                         }
                                                                                           }
                                                                         }
                                                      },
                                     "annotations":  {
                                                         "title":  "Document Agent",
                                                         "readOnlyHint":  true,
                                                         "destructiveHint":  false,
                                                         "idempotentHint":  false,
                                                         "openWorldHint":  false,
                                                         "returnDirect":  true
                                                     },
                                     "_meta":  {
                                                   "customerFacingDescription":  "Discover the dashboards and notebooks you need by searching for documents whose titles match your chosen keywords."
                                               }
                                 },
                                 {
                                     "name":  "find-troubleshooting-guides",
                                     "title":  "Troubleshooting Agent",
                                     "description":  "Searches across pre indexed dashboards and notebooks in the Dynatrace platform\nto find relevant troubleshooting guides based on a specific set of search strings.\nCan be used to find troubleshooting guides for specific Davis problems\nbased on the problem description.\n",
                                     "inputSchema":  {
                                                         "type":  "object",
                                                         "properties":  {
                                                                            "searchStrings":  {
                                                                                                  "type":  "string",
                                                                                                  "description":  "Comma separated list of search strings to find relevant documents for.\nFor Davis Problems it is best to use one value only. Use the event.description field of the problem record.\n"
                                                                                              }
                                                                        },
                                                         "required":  [
                                                                          "searchStrings"
                                                                      ],
                                                         "additionalProperties":  false
                                                     },
                                     "outputSchema":  {
                                                          "description":  "List of matching documents and the relevance score for each match.",
                                                          "title":  "Find relevant troubleshooting guides result",
                                                          "type":  "object",
                                                          "properties":  {
                                                                             "results":  {
                                                                                             "type:":  "array",
                                                                                             "description":  "List of matching documents and the relevance score for each match.",
                                                                                             "items":  {
                                                                                                           "type":  "object",
                                                                                                           "required":  [
                                                                                                                            "documentId",
                                                                                                                            "relevanceScore"
                                                                                                                        ],
                                                                                                           "properties":  {
                                                                                                                              "documentId":  {
                                                                                                                                                 "description":  "The unique identifier of the troubleshooting document.",
                                                                                                                                                 "type":  "string"
                                                                                                                                             },
                                                                                                                              "relevanceScore":  {
                                                                                                                                                     "description":  "Score indicating how closely the troubleshooting document matches the search strings",
                                                                                                                                                     "type":  "number"
                                                                                                                                                 },
                                                                                                                              "documentMetadata":  {
                                                                                                                                                       "type":  "object",
                                                                                                                                                       "description":  "Metadata associated with the matching troubleshooting document",
                                                                                                                                                       "additionalProperties":  true,
                                                                                                                                                       "properties":  {
                                                                                                                                                                          "id":  {
                                                                                                                                                                                     "type":  "string",
                                                                                                                                                                                     "description":  "Internal document ID"
                                                                                                                                                                                 },
                                                                                                                                                                          "externalId":  {
                                                                                                                                                                                             "type":  "string",
                                                                                                                                                                                             "description":  "External reference ID"
                                                                                                                                                                                         },
                                                                                                                                                                          "name":  {
                                                                                                                                                                                       "type":  "string",
                                                                                                                                                                                       "description":  "Human-readable name of the document"
                                                                                                                                                                                   },
                                                                                                                                                                          "type":  {
                                                                                                                                                                                       "type":  "string",
                                                                                                                                                                                       "description":  "Type of the document (e.g., dashboard)"
                                                                                                                                                                                   }
                                                                                                                                                                      },
                                                                                                                                                       "required":  [
                                                                                                                                                                        "id",
                                                                                                                                                                        "name",
                                                                                                                                                                        "type"
                                                                                                                                                                    ]
                                                                                                                                                   }
                                                                                                                          }
                                                                                                       }
                                                                                         }
                                                                         }
                                                      },
                                     "annotations":  {
                                                         "title":  "Troubleshooting Agent",
                                                         "readOnlyHint":  true,
                                                         "destructiveHint":  false,
                                                         "idempotentHint":  false,
                                                         "openWorldHint":  false,
                                                         "returnDirect":  true
                                                     },
                                     "_meta":  {
                                                   "customerFacingDescription":  "Quickly find the most relevant troubleshooting guides by searching across all preâindexed Dynatrace dashboards and notebooks. Helps diagnosing issues or pinpointing solutions for specific problems."
                                               }
                                 },
                                 {
                                     "name":  "get-entity-id",
                                     "title":  "Smartscape Agent",
                                     "description":  "Search entity IDs matching a given entity type and name filter.\nReturns nothing if no entity of the given type and name is found.\n",
                                     "inputSchema":  {
                                                         "type":  "object",
                                                         "properties":  {
                                                                            "entityNameFilter":  {
                                                                                                     "type":  "string",
                                                                                                     "description":  "The entity name filter. Entities which contain this string are valid matches (case-insensitive).\nFor example App-Prod, FrontEndService.\n"
                                                                                                 },
                                                                            "includeTypes":  {
                                                                                                 "type":  "boolean",
                                                                                                 "description":  "If true the DQL query result types will be included in the result. Default value is true."
                                                                                             },
                                                                            "entityType":  {
                                                                                               "type":  "string",
                                                                                               "description":  "The entity type name. Available entity types can be found in the Dynatrace documentation.\nEntity type **MUST** start with \"dt.entity.\" followed by lower case type.\nExamples: dt.entity.host, dt.entity.process_group, dt.entity.service, dt.entity.kubernetes_cluster,\ndt.entity.kubernetes_node, dt.entity.process_group_instance, dt.entity.application, etc.\n"
                                                                                           }
                                                                        },
                                                         "required":  [
                                                                          "entityType",
                                                                          "entityNameFilter"
                                                                      ],
                                                         "additionalProperties":  false
                                                     },
                                     "outputSchema":  {
                                                          "description":  "Result of executing a DQL query against Dynatrace Grail",
                                                          "properties":  {
                                                                             "records":  {
                                                                                             "description":  "The records returned by the DQL query.",
                                                                                             "type":  "array",
                                                                                             "items":  {
                                                                                                           "additionalProperties":  true,
                                                                                                           "type":  "object"
                                                                                                       }
                                                                                         },
                                                                             "types":  {
                                                                                           "description":  "The types for the records returned by the DQL query.",
                                                                                           "type":  "array",
                                                                                           "items":  {
                                                                                                         "additionalProperties":  true,
                                                                                                         "type":  "object"
                                                                                                     },
                                                                                           "annotations":  {
                                                                                                               "audience":  [
                                                                                                                                "user"
                                                                                                                            ]
                                                                                                           }
                                                                                       },
                                                                             "metadata":  {
                                                                                              "description":  "Metadata about the query execution and results from Grail",
                                                                                              "type":  "object",
                                                                                              "annotations":  {
                                                                                                                  "audience":  [
                                                                                                                                   "user"
                                                                                                                               ]
                                                                                                              }
                                                                                          }
                                                                         },
                                                          "required":  [
                                                                           "records"
                                                                       ],
                                                          "title":  "Grail DQL Query Result",
                                                          "type":  "object",
                                                          "x-content-type":  "application/x-grail-query-result"
                                                      },
                                     "annotations":  {
                                                         "title":  "Smartscape Agent",
                                                         "readOnlyHint":  true,
                                                         "destructiveHint":  false,
                                                         "idempotentHint":  false,
                                                         "openWorldHint":  false,
                                                         "returnDirect":  true
                                                     },
                                     "_meta":  {
                                                   "ui":  {
                                                              "resourceUri":  "ui://visualizeGrailResults.html"
                                                          },
                                                   "customerFacingDescription":  "Look up one or multiple entities and their IDs, searching by an entity name."
                                               }
                                 },
                                 {
                                     "name":  "get-entity-name",
                                     "title":  "Smartscape Agent",
                                     "description":  "Provides the human readable name for a given entity id.",
                                     "inputSchema":  {
                                                         "type":  "object",
                                                         "properties":  {
                                                                            "includeTypes":  {
                                                                                                 "type":  "boolean",
                                                                                                 "description":  "If true the DQL query result types will be included in the result. Default value is true."
                                                                                             },
                                                                            "entityType":  {
                                                                                               "type":  "string",
                                                                                               "description":  "The entity type matching the entity ID. For instance dt.entity.host.\nThe entity type can be extracted from the entity ID:\n  take the part before the first hyphen, make it lower case, and prefix it with \"dt.entity.\".\n  Examples: entity id \"HOST-45EC258BE1539C76\" =\u003e entity type dt.entity.host.\n  entity id \"SERVICE-1234567890ABCDEF\" =\u003e entity type dt.entity.service.\n  entity id \"KUBERNETES_CLUSTER-1234567890ABCDEF\" =\u003e entity type dt.entity.kubernetes_cluster.\n  entity id \"PROCESS_GROUP_INSTANCE-F756DBCDB303B1FE\" =\u003e entity type dt.entity.process_group_instance.\n"
                                                                                           },
                                                                            "entityId":  {
                                                                                             "type":  "string",
                                                                                             "description":  "an entity ID. For instance HOST-45EC258BE1539C76"
                                                                                         }
                                                                        },
                                                         "required":  [
                                                                          "entityType",
                                                                          "entityId"
                                                                      ],
                                                         "additionalProperties":  false
                                                     },
                                     "outputSchema":  {
                                                          "description":  "Result of executing a DQL query against Dynatrace Grail",
                                                          "properties":  {
                                                                             "records":  {
                                                                                             "description":  "The records returned by the DQL query.",
                                                                                             "type":  "array",
                                                                                             "items":  {
                                                                                                           "additionalProperties":  true,
                                                                                                           "type":  "object"
                                                                                                       }
                                                                                         },
                                                                             "types":  {
                                                                                           "description":  "The types for the records returned by the DQL query.",
                                                                                           "type":  "array",
                                                                                           "items":  {
                                                                                                         "additionalProperties":  true,
                                                                                                         "type":  "object"
                                                                                                     },
                                                                                           "annotations":  {
                                                                                                               "audience":  [
                                                                                                                                "user"
                                                                                                                            ]
                                                                                                           }
                                                                                       },
                                                                             "metadata":  {
                                                                                              "description":  "Metadata about the query execution and results from Grail",
                                                                                              "type":  "object",
                                                                                              "annotations":  {
                                                                                                                  "audience":  [
                                                                                                                                   "user"
                                                                                                                               ]
                                                                                                              }
                                                                                          }
                                                                         },
                                                          "required":  [
                                                                           "records"
                                                                       ],
                                                          "title":  "Grail DQL Query Result",
                                                          "type":  "object",
                                                          "x-content-type":  "application/x-grail-query-result"
                                                      },
                                     "annotations":  {
                                                         "title":  "Smartscape Agent",
                                                         "readOnlyHint":  true,
                                                         "destructiveHint":  false,
                                                         "idempotentHint":  false,
                                                         "openWorldHint":  false,
                                                         "returnDirect":  true
                                                     },
                                     "_meta":  {
                                                   "ui":  {
                                                              "resourceUri":  "ui://visualizeGrailResults.html"
                                                          },
                                                   "customerFacingDescription":  "Look up the entity name by entity ID"
                                               }
                                 },
                                 {
                                     "name":  "get-events-for-kubernetes-cluster",
                                     "title":  "Kubernetes Agent",
                                     "description":  "Get all events for all Kubernetes (K8s) clusters or for a specific cluster by providing either the clusterId or the kubernetesEntityId.",
                                     "inputSchema":  {
                                                         "type":  "object",
                                                         "properties":  {
                                                                            "includeTypes":  {
                                                                                                 "type":  "boolean",
                                                                                                 "description":  "If true the DQL query result types will be included in the result. Default value is true."
                                                                                             },
                                                                            "clusterId":  {
                                                                                              "type":  "string",
                                                                                              "description":  "The cluster ID of the Kubernetes cluster to get events for."
                                                                                          },
                                                                            "history":  {
                                                                                            "type":  "string",
                                                                                            "description":  "Specifies the time range in minutes (m), hours (h), or days (d) to look back when querying Kubernetes events:\nevents with a timestamp in the range [now-history, now] are returned.\nInteger hours to look back from now (e.g., 30m = last half an hour, 5h = last 5 hours, 2d = last 2 days, 7d = last week)\n**DO NOT** use values greater than 60 days unless explicitly requested by the user.\n"
                                                                                        },
                                                                            "findAllK8Events":  {
                                                                                                    "type":  "string",
                                                                                                    "description":  "If true, all events for all K8s clusters are returned. If false, only events for the specified clusterId or kubernetesEntityId are returned."
                                                                                                },
                                                                            "kubernetesEntityId":  {
                                                                                                       "type":  "string",
                                                                                                       "description":  "The Dynatrace entity ID of the Kubernetes cluster to get events for."
                                                                                                   }
                                                                        },
                                                         "required":  [

                                                                      ],
                                                         "additionalProperties":  false
                                                     },
                                     "outputSchema":  {
                                                          "description":  "Result of executing a DQL query against Dynatrace Grail",
                                                          "properties":  {
                                                                             "records":  {
                                                                                             "description":  "The records returned by the DQL query.",
                                                                                             "type":  "array",
                                                                                             "items":  {
                                                                                                           "additionalProperties":  true,
                                                                                                           "type":  "object"
                                                                                                       }
                                                                                         },
                                                                             "types":  {
                                                                                           "description":  "The types for the records returned by the DQL query.",
                                                                                           "type":  "array",
                                                                                           "items":  {
                                                                                                         "additionalProperties":  true,
                                                                                                         "type":  "object"
                                                                                                     },
                                                                                           "annotations":  {
                                                                                                               "audience":  [
                                                                                                                                "user"
                                                                                                                            ]
                                                                                                           }
                                                                                       },
                                                                             "metadata":  {
                                                                                              "description":  "Metadata about the query execution and results from Grail",
                                                                                              "type":  "object",
                                                                                              "annotations":  {
                                                                                                                  "audience":  [
                                                                                                                                   "user"
                                                                                                                               ]
                                                                                                              }
                                                                                          }
                                                                         },
                                                          "required":  [
                                                                           "records"
                                                                       ],
                                                          "title":  "Grail DQL Query Result",
                                                          "type":  "object",
                                                          "x-content-type":  "application/x-grail-query-result"
                                                      },
                                     "annotations":  {
                                                         "title":  "Kubernetes Agent",
                                                         "readOnlyHint":  true,
                                                         "destructiveHint":  false,
                                                         "idempotentHint":  false,
                                                         "openWorldHint":  false,
                                                         "returnDirect":  true
                                                     },
                                     "_meta":  {
                                                   "ui":  {
                                                              "resourceUri":  "ui://visualizeGrailResults.html"
                                                          },
                                                   "customerFacingDescription":  "Explore all Kubernetes cluster events, optionally filtered for a specific cluster."
                                               }
                                 },
                                 {
                                     "name":  "get-problem-by-id",
                                     "title":  "Root Cause Details Agent",
                                     "description":  "Read details of a single Davis problem by its display id, typically stored in the field name event.id or display_id",
                                     "inputSchema":  {
                                                         "type":  "object",
                                                         "properties":  {
                                                                            "problemId":  {
                                                                                              "type":  "string",
                                                                                              "description":  "the problem id. The format is \u0027number_numberV2\u0027 or number_number or P-number."
                                                                                          },
                                                                            "includeTypes":  {
                                                                                                 "type":  "boolean",
                                                                                                 "description":  "If true the DQL query result types will be included in the result. Default value is true."
                                                                                             },
                                                                            "history":  {
                                                                                            "type":  "string",
                                                                                            "description":  "Specifies the time range in minutes (m), hours (h), or days (d) to look back when querying Davis problems:\nproblems with a timestamp in the range [now-history, now] are returned.\nInteger hours to look back from now (e.g., 30m = last half an hour, 5h = last 5 hours, 2d = last 2 days, 7d = last week)\n**DO NOT** use values greater than 60 days unless explicitly requested by the user.\n"
                                                                                        }
                                                                        },
                                                         "required":  [
                                                                          "problemId"
                                                                      ],
                                                         "additionalProperties":  false
                                                     },
                                     "outputSchema":  {
                                                          "description":  "Result of executing a DQL query against Dynatrace Grail",
                                                          "properties":  {
                                                                             "records":  {
                                                                                             "description":  "The records returned by the DQL query.",
                                                                                             "type":  "array",
                                                                                             "items":  {
                                                                                                           "additionalProperties":  true,
                                                                                                           "type":  "object"
                                                                                                       }
                                                                                         },
                                                                             "types":  {
                                                                                           "description":  "The types for the records returned by the DQL query.",
                                                                                           "type":  "array",
                                                                                           "items":  {
                                                                                                         "additionalProperties":  true,
                                                                                                         "type":  "object"
                                                                                                     },
                                                                                           "annotations":  {
                                                                                                               "audience":  [
                                                                                                                                "user"
                                                                                                                            ]
                                                                                                           }
                                                                                       },
                                                                             "metadata":  {
                                                                                              "description":  "Metadata about the query execution and results from Grail",
                                                                                              "type":  "object",
                                                                                              "annotations":  {
                                                                                                                  "audience":  [
                                                                                                                                   "user"
                                                                                                                               ]
                                                                                                              }
                                                                                          }
                                                                         },
                                                          "required":  [
                                                                           "records"
                                                                       ],
                                                          "title":  "Grail DQL Query Result",
                                                          "type":  "object",
                                                          "x-content-type":  "application/x-grail-query-result"
                                                      },
                                     "annotations":  {
                                                         "title":  "Root Cause Details Agent",
                                                         "readOnlyHint":  true,
                                                         "destructiveHint":  false,
                                                         "idempotentHint":  false,
                                                         "openWorldHint":  false,
                                                         "returnDirect":  true
                                                     },
                                     "_meta":  {
                                                   "ui":  {
                                                              "resourceUri":  "ui://visualizeGrailResults.html"
                                                          },
                                                   "customerFacingDescription":  "Retrieve the full details of any Davis problem by providing its display ID."
                                               }
                                 },
                                 {
                                     "name":  "get-vulnerabilities",
                                     "title":  "Vulnerability Agent",
                                     "description":  "Retrieve all active (non-muted) security vulnerabilities from Dynatrace for the last 30 days. An additional riskScore filter can be provided.",
                                     "inputSchema":  {
                                                         "type":  "object",
                                                         "properties":  {
                                                                            "includeTypes":  {
                                                                                                 "type":  "boolean",
                                                                                                 "description":  "If true the DQL query result types will be included in the result. Default value is true."
                                                                                             },
                                                                            "riskLevel":  {
                                                                                              "type":  "string",
                                                                                              "description":  "Risk level to filter vulnerabilities by. The value can be one of the following values:\nCRITICAL, HIGH, MEDIUM, LOW or ALL\nIf ALL is provided then vulnerabilities of all levels are returned.\nThe default value is ALL\n"
                                                                                          },
                                                                            "affectedEntityID":  {
                                                                                                     "type":  "string",
                                                                                                     "description":  "The Dynatrace entity ID to filter vulnerabilities for. Use \"ALL\" to get vulnerabilities for all entities.\nThe affected entity is usually of type \"dt.entity.process_group\", \"dt.entity.host\" or \"dt.entity.kubernetes_node\".\nIf attempting to get an entity ID from the entity name before calling this tool, use one of those types.\nThe default value is ALL.\n"
                                                                                                 }
                                                                        },
                                                         "required":  [

                                                                      ],
                                                         "additionalProperties":  false
                                                     },
                                     "outputSchema":  {
                                                          "description":  "Result of executing a DQL query against Dynatrace Grail",
                                                          "properties":  {
                                                                             "records":  {
                                                                                             "description":  "The records returned by the DQL query.",
                                                                                             "type":  "array",
                                                                                             "items":  {
                                                                                                           "additionalProperties":  true,
                                                                                                           "type":  "object"
                                                                                                       }
                                                                                         },
                                                                             "types":  {
                                                                                           "description":  "The types for the records returned by the DQL query.",
                                                                                           "type":  "array",
                                                                                           "items":  {
                                                                                                         "additionalProperties":  true,
                                                                                                         "type":  "object"
                                                                                                     },
                                                                                           "annotations":  {
                                                                                                               "audience":  [
                                                                                                                                "user"
                                                                                                                            ]
                                                                                                           }
                                                                                       },
                                                                             "metadata":  {
                                                                                              "description":  "Metadata about the query execution and results from Grail",
                                                                                              "type":  "object",
                                                                                              "annotations":  {
                                                                                                                  "audience":  [
                                                                                                                                   "user"
                                                                                                                               ]
                                                                                                              }
                                                                                          }
                                                                         },
                                                          "required":  [
                                                                           "records"
                                                                       ],
                                                          "title":  "Grail DQL Query Result",
                                                          "type":  "object",
                                                          "x-content-type":  "application/x-grail-query-result"
                                                      },
                                     "annotations":  {
                                                         "title":  "Vulnerability Agent",
                                                         "readOnlyHint":  true,
                                                         "destructiveHint":  false,
                                                         "idempotentHint":  false,
                                                         "openWorldHint":  false,
                                                         "returnDirect":  true
                                                     },
                                     "_meta":  {
                                                   "ui":  {
                                                              "resourceUri":  "ui://visualizeGrailResults.html"
                                                          },
                                                   "customerFacingDescription":  "Explore all active security vulnerabilities from the past 30 days, optionally filtered by risk score."
                                               }
                                 },
                                 {
                                     "name":  "query-problems",
                                     "title":  "Root Cause Agent",
                                     "description":  "Query all Davis Problems.\nWhen querying Davis problems, it\u0027s important to understand their lifecycle and how to filter results effectively.\nWithin a problem lifecycle, each problem has a start time. If the end time is not set, the problem is considered ACTIVE. Once an end time is defined, the problem is considered CLOSED.\nOnly the 200 most recent problems are returned.\n",
                                     "inputSchema":  {
                                                         "type":  "object",
                                                         "properties":  {
                                                                            "includeTypes":  {
                                                                                                 "type":  "boolean",
                                                                                                 "description":  "If true the DQL query result types will be included in the result. Default value is true."
                                                                                             },
                                                                            "history":  {
                                                                                            "type":  "string",
                                                                                            "description":  "Specifies the time range in minutes (m), hours (h), or days (d) to look back when querying Davis problems:\nproblems with a timestamp in the range [now-history, now] are returned.\nInteger hours to look back from now (e.g., 30m = last half an hour, 5h = last 5 hours, 2d = last 2 days, 7d = last week)\n**DO NOT** use values greater than 60 days unless explicitly requested by the user.\n"
                                                                                        },
                                                                            "status":  {
                                                                                           "type":  "string",
                                                                                           "description":  "the status of the problem to query. The value can be one of the following values:\nACTIVE, CLOSED or ALL.\nIf ALL is provided then both ACTIVE and CLOSED problems are returned.\nThe default value is ALL\n"
                                                                                       }
                                                                        },
                                                         "required":  [

                                                                      ],
                                                         "additionalProperties":  false
                                                     },
                                     "outputSchema":  {
                                                          "description":  "Result of executing a DQL query against Dynatrace Grail",
                                                          "properties":  {
                                                                             "records":  {
                                                                                             "description":  "The records returned by the DQL query.",
                                                                                             "type":  "array",
                                                                                             "items":  {
                                                                                                           "additionalProperties":  true,
                                                                                                           "type":  "object"
                                                                                                       }
                                                                                         },
                                                                             "types":  {
                                                                                           "description":  "The types for the records returned by the DQL query.",
                                                                                           "type":  "array",
                                                                                           "items":  {
                                                                                                         "additionalProperties":  true,
                                                                                                         "type":  "object"
                                                                                                     },
                                                                                           "annotations":  {
                                                                                                               "audience":  [
                                                                                                                                "user"
                                                                                                                            ]
                                                                                                           }
                                                                                       },
                                                                             "metadata":  {
                                                                                              "description":  "Metadata about the query execution and results from Grail",
                                                                                              "type":  "object",
                                                                                              "annotations":  {
                                                                                                                  "audience":  [
                                                                                                                                   "user"
                                                                                                                               ]
                                                                                                              }
                                                                                          }
                                                                         },
                                                          "required":  [
                                                                           "records"
                                                                       ],
                                                          "title":  "Grail DQL Query Result",
                                                          "type":  "object",
                                                          "x-content-type":  "application/x-grail-query-result"
                                                      },
                                     "annotations":  {
                                                         "title":  "Root Cause Agent",
                                                         "readOnlyHint":  true,
                                                         "destructiveHint":  false,
                                                         "idempotentHint":  false,
                                                         "openWorldHint":  false,
                                                         "returnDirect":  true
                                                     },
                                     "_meta":  {
                                                   "ui":  {
                                                              "resourceUri":  "ui://visualizeGrailResults.html"
                                                          },
                                                   "customerFacingDescription":  "Explore the 200 most recent problems, active or closed."
                                               }
                                 },
                                 {
                                     "name":  "seasonal-baseline-anomaly-detector",
                                     "title":  "Seasonal Baseline Agent",
                                     "description":  "Detects anomalies in time series by learning normal behavior from historical data and establishing dynamic baseline thresholds that can account for seasonal patterns like daily and weekly traffic patterns.\nTimeframe for analysis should never be set in the future.\nIt is advisable to use the create-dql tool beforehand to get a valid DQL query as input for this tool.\n",
                                     "inputSchema":  {
                                                         "type":  "object",
                                                         "properties":  {
                                                                            "generalParameters":  {
                                                                                                      "title":  "General parameters",
                                                                                                      "description":  "General query parameter",
                                                                                                      "type":  "object",
                                                                                                      "additionalProperties":  true,
                                                                                                      "properties":  {
                                                                                                                         "timeframe":  {
                                                                                                                                           "title":  "Timeframe",
                                                                                                                                           "description":  "By default, the general timeframe for queries is the last 2 hours from now. If only a startTime is provided, the current time will be used as the endTime.",
                                                                                                                                           "type":  "object",
                                                                                                                                           "additionalProperties":  false,
                                                                                                                                           "properties":  {
                                                                                                                                                              "startTime":  {
                                                                                                                                                                                "title":  "Start time",
                                                                                                                                                                                "description":  "Supports absolute or relative timestamps. Specify an absolute time in the ISO 8601 (yyyy-MM-ddTHH:mm:ssZ) format or use a relative time such as \u0027now-2h\u0027. For relative timestamps only hours, minutes and days are allowed and are abbreviated as h, m and d respectively. Only lowercase input is accepted.",
                                                                                                                                                                                "type":  "string",
                                                                                                                                                                                "examples":  [
                                                                                                                                                                                                 "2023-04-10T12:00Z",
                                                                                                                                                                                                 "now-2h"
                                                                                                                                                                                             ],
                                                                                                                                                                                "default":  "now-2h"
                                                                                                                                                                            },
                                                                                                                                                              "endTime":  {
                                                                                                                                                                              "title":  "End time",
                                                                                                                                                                              "type":  "string",
                                                                                                                                                                              "examples":  [
                                                                                                                                                                                               "2023-04-12T12:00Z",
                                                                                                                                                                                               "now"
                                                                                                                                                                                           ],
                                                                                                                                                                              "default":  "now"
                                                                                                                                                                          }
                                                                                                                                                          },
                                                                                                                                           "required":  [
                                                                                                                                                            "startTime"
                                                                                                                                                        ]
                                                                                                                                       }
                                                                                                                     }
                                                                                                  },
                                                                            "timeSeriesData":  {
                                                                                                   "title":  "Time series data",
                                                                                                   "description":  "Time series data or query to analyze. Supports the Dynatrace Query Language (DQL).",
                                                                                                   "oneOf":  [
                                                                                                                 {
                                                                                                                     "type":  "string"
                                                                                                                 },
                                                                                                                 {
                                                                                                                     "type":  "object"
                                                                                                                 }
                                                                                                             ]
                                                                                               },
                                                                            "tolerance":  {
                                                                                              "title":  "Tolerance",
                                                                                              "description":  " Value must be between 0.1 and 10.0. The default value is 4.0.",
                                                                                              "type":  "number"
                                                                                          },
                                                                            "alertCondition":  {
                                                                                                   "title":  "Alert condition",
                                                                                                   "type":  "string",
                                                                                                   "anyOf":  [
                                                                                                                 {
                                                                                                                     "title":  "Alert if metric is below",
                                                                                                                     "description":  "Alert only if values are below a threshold.",
                                                                                                                     "enum":  [
                                                                                                                                  "BELOW"
                                                                                                                              ]
                                                                                                                 },
                                                                                                                 {
                                                                                                                     "title":  "Alert if metric is above",
                                                                                                                     "description":  "Alert only if values are above a threshold.",
                                                                                                                     "enum":  [
                                                                                                                                  "ABOVE"
                                                                                                                              ]
                                                                                                                 },
                                                                                                                 {
                                                                                                                     "title":  "Alert if metric is outside",
                                                                                                                     "description":  "Alert if values are above or below a threshold.",
                                                                                                                     "enum":  [
                                                                                                                                  "OUTSIDE"
                                                                                                                              ]
                                                                                                                 }
                                                                                                             ]
                                                                                               },
                                                                            "alertOnMissingData":  {
                                                                                                       "title":  "Alert on missing data",
                                                                                                       "description":  "The ability to set an alert on missing data in a metric. When enabled, missing data samples will be treated as violating samples. When disabled, missing data is not treated as a violation but will still contribute to dealerting. We recommend disabling alerting on missing data for sparse timeseries to avoid false alerts. To learn more, visit [anomaly detection configuration](https://dt-url.net/lz02mwi).",
                                                                                                       "type":  "boolean"
                                                                                                   },
                                                                            "violatingSamples":  {
                                                                                                     "title":  "Violating samples",
                                                                                                     "description":  "Total number of samples in the sliding window that must violate to trigger an event. Value must be between 1 and 60. The default value is 3.",
                                                                                                     "type":  "integer"
                                                                                                 },
                                                                            "slidingWindow":  {
                                                                                                  "title":  "Sliding window",
                                                                                                  "description":  "Total number of samples that form the sliding window. Value must be between 1 and 60. The default value is 5.",
                                                                                                  "type":  "integer"
                                                                                              },
                                                                            "dealertingSamples":  {
                                                                                                      "title":  "Dealerting samples",
                                                                                                      "description":  "Total number of samples in the sliding window that must go back to normal to close the event. Value must be between 1 and 60. The default value is 5.",
                                                                                                      "type":  "integer"
                                                                                                  }
                                                                        },
                                                         "required":  [
                                                                          "timeSeriesData",
                                                                          "tolerance"
                                                                      ],
                                                         "additionalProperties":  false
                                                     },
                                     "outputSchema":  {
                                                          "title":  "Result for Seasonal baseline anomaly detection",
                                                          "$schema":  "http://json-schema.org/draft-07/schema#",
                                                          "description":  "[Learn more](https://dt-url.net/7603b6m)",
                                                          "type":  "object",
                                                          "additionalProperties":  false,
                                                          "required":  [
                                                                           "resultStatus",
                                                                           "executionStatus",
                                                                           "resultId",
                                                                           "output"
                                                                       ],
                                                          "properties":  {
                                                                             "resultStatus":  {
                                                                                                  "title":  "resultStatus",
                                                                                                  "type":  "string",
                                                                                                  "anyOf":  [
                                                                                                                {
                                                                                                                    "title":  "Successful",
                                                                                                                    "description":  "Successful result",
                                                                                                                    "enum":  [
                                                                                                                                 "SUCCESSFUL"
                                                                                                                             ]
                                                                                                                },
                                                                                                                {
                                                                                                                    "title":  "Successful with warnings",
                                                                                                                    "description":  "Successful result contains warnings",
                                                                                                                    "enum":  [
                                                                                                                                 "SUCCESSFUL_WITH_WARNINGS"
                                                                                                                             ]
                                                                                                                },
                                                                                                                {
                                                                                                                    "title":  "Failed",
                                                                                                                    "description":  "Failed result",
                                                                                                                    "enum":  [
                                                                                                                                 "FAILED"
                                                                                                                             ]
                                                                                                                }
                                                                                                            ]
                                                                                              },
                                                                             "executionStatus":  {
                                                                                                     "title":  "executionStatus",
                                                                                                     "type":  "string",
                                                                                                     "anyOf":  [
                                                                                                                   {
                                                                                                                       "title":  "Running",
                                                                                                                       "description":  "Execution still running",
                                                                                                                       "enum":  [
                                                                                                                                    "RUNNING"
                                                                                                                                ]
                                                                                                                   },
                                                                                                                   {
                                                                                                                       "title":  "Aborted",
                                                                                                                       "description":  "Execution manually canceled",
                                                                                                                       "enum":  [
                                                                                                                                    "ABORTED"
                                                                                                                                ]
                                                                                                                   },
                                                                                                                   {
                                                                                                                       "title":  "Completed",
                                                                                                                       "description":  "Execution completed",
                                                                                                                       "enum":  [
                                                                                                                                    "COMPLETED"
                                                                                                                                ]
                                                                                                                   }
                                                                                                               ]
                                                                                                 },
                                                                             "resultId":  {
                                                                                              "title":  "resultId",
                                                                                              "type":  "string"
                                                                                          },
                                                                             "input":  {
                                                                                           "type":  "object"
                                                                                       },
                                                                             "output":  {
                                                                                            "type":  "array",
                                                                                            "items":  {
                                                                                                          "type":  "object",
                                                                                                          "additionalProperties":  false,
                                                                                                          "required":  [
                                                                                                                           "analysisStatus",
                                                                                                                           "analyzedTimeSeriesQuery"
                                                                                                                       ],
                                                                                                          "properties":  {
                                                                                                                             "system":  {
                                                                                                                                            "title":  "System",
                                                                                                                                            "description":  "Output system parameters",
                                                                                                                                            "type":  "object",
                                                                                                                                            "additionalProperties":  false,
                                                                                                                                            "properties":  {
                                                                                                                                                               "logs":  {
                                                                                                                                                                            "title":  "Logs",
                                                                                                                                                                            "description":  "Logs connected to a specific output",
                                                                                                                                                                            "type":  "array",
                                                                                                                                                                            "items":  {
                                                                                                                                                                                          "type":  "object",
                                                                                                                                                                                          "additionalProperties":  false,
                                                                                                                                                                                          "required":  [
                                                                                                                                                                                                           "level",
                                                                                                                                                                                                           "message"
                                                                                                                                                                                                       ],
                                                                                                                                                                                          "properties":  {
                                                                                                                                                                                                             "level":  {
                                                                                                                                                                                                                           "title":  "Level",
                                                                                                                                                                                                                           "type":  "string",
                                                                                                                                                                                                                           "anyOf":  [
                                                                                                                                                                                                                                         {
                                                                                                                                                                                                                                             "title":  "Tracing",
                                                                                                                                                                                                                                             "description":  "Tracing",
                                                                                                                                                                                                                                             "enum":  [
                                                                                                                                                                                                                                                          "TRACING"
                                                                                                                                                                                                                                                      ]
                                                                                                                                                                                                                                         },
                                                                                                                                                                                                                                         {
                                                                                                                                                                                                                                             "title":  "Info",
                                                                                                                                                                                                                                             "description":  "Info",
                                                                                                                                                                                                                                             "enum":  [
                                                                                                                                                                                                                                                          "INFO"
                                                                                                                                                                                                                                                      ]
                                                                                                                                                                                                                                         },
                                                                                                                                                                                                                                         {
                                                                                                                                                                                                                                             "title":  "Warning",
                                                                                                                                                                                                                                             "description":  "Warning",
                                                                                                                                                                                                                                             "enum":  [
                                                                                                                                                                                                                                                          "WARNING"
                                                                                                                                                                                                                                                      ]
                                                                                                                                                                                                                                         }
                                                                                                                                                                                                                                     ]
                                                                                                                                                                                                                       },
                                                                                                                                                                                                             "message":  {
                                                                                                                                                                                                                             "title":  "Message",
                                                                                                                                                                                                                             "type":  "string"
                                                                                                                                                                                                                         }
                                                                                                                                                                                                         }
                                                                                                                                                                                      }
                                                                                                                                                                        }
                                                                                                                                                           }
                                                                                                                                        },
                                                                                                                             "analysisStatus":  {
                                                                                                                                                    "title":  "The status of an analysis",
                                                                                                                                                    "description":  "The status of an analysis of a particular univariate data.",
                                                                                                                                                    "type":  "string",
                                                                                                                                                    "anyOf":  [
                                                                                                                                                                  {
                                                                                                                                                                      "title":  "OK",
                                                                                                                                                                      "description":  "The analysis was performed successfully, the result is available.",
                                                                                                                                                                      "enum":  [
                                                                                                                                                                                   "OK"
                                                                                                                                                                               ]
                                                                                                                                                                  },
                                                                                                                                                                  {
                                                                                                                                                                      "title":  "Failed",
                                                                                                                                                                      "description":  "There was a problem during an analysis, the result is not available.",
                                                                                                                                                                      "enum":  [
                                                                                                                                                                                   "FAILED"
                                                                                                                                                                               ]
                                                                                                                                                                  }
                                                                                                                                                              ]
                                                                                                                                                },
                                                                                                                             "analyzedTimeSeriesQuery":  {
                                                                                                                                                             "title":  "Analyzed time series query",
                                                                                                                                                             "description":  "Time series query that corresponds to the analyzed univariate data.",
                                                                                                                                                             "oneOf":  [
                                                                                                                                                                           {
                                                                                                                                                                               "type":  "string"
                                                                                                                                                                           },
                                                                                                                                                                           {
                                                                                                                                                                               "type":  "object"
                                                                                                                                                                           }
                                                                                                                                                                       ]
                                                                                                                                                         },
                                                                                                                             "anomalyDetectorBounds":  {
                                                                                                                                                           "title":  "Bounds of anomaly detector",
                                                                                                                                                           "description":  "Bounds of anomaly detector in order to count a value as an anomaly. The bounds are reported as a multivariate time series data array with properties {dt.davis.anomaly_detection: lower}, {dt.davis.anomaly_detection: upper} or both on the respective columns.",
                                                                                                                                                           "type":  "object"
                                                                                                                                                       },
                                                                                                                             "raisedAlerts":  {
                                                                                                                                                  "title":  "Raised alerts",
                                                                                                                                                  "description":  "List of raised alerts found within the evaluation time frame",
                                                                                                                                                  "type":  "array",
                                                                                                                                                  "items":  {
                                                                                                                                                                "type":  "object",
                                                                                                                                                                "additionalProperties":  false,
                                                                                                                                                                "required":  [
                                                                                                                                                                                 "timeframe",
                                                                                                                                                                                 "numberOfViolations"
                                                                                                                                                                             ],
                                                                                                                                                                "properties":  {
                                                                                                                                                                                   "timeframe":  {
                                                                                                                                                                                                     "title":  "Timeframe",
                                                                                                                                                                                                     "description":  "Represents the start and end time of an alert, given in ms. If only a startTime is provided, the current time will be used as the endTime.",
                                                                                                                                                                                                     "type":  "object",
                                                                                                                                                                                                     "additionalProperties":  false,
                                                                                                                                                                                                     "properties":  {
                                                                                                                                                                                                                        "startTime":  {
                                                                                                                                                                                                                                          "title":  "Start time",
                                                                                                                                                                                                                                          "description":  "Supports absolute or relative timestamps. Specify an absolute time in the ISO 8601 (yyyy-MM-ddTHH:mm:ssZ) format or use a relative time such as \u0027now-2h\u0027. For relative timestamps only hours, minutes and days are allowed and are abbreviated as h, m and d respectively. Only lowercase input is accepted.",
                                                                                                                                                                                                                                          "type":  "string",
                                                                                                                                                                                                                                          "examples":  [
                                                                                                                                                                                                                                                           "2023-04-10T12:00Z",
                                                                                                                                                                                                                                                           "now-2h"
                                                                                                                                                                                                                                                       ]
                                                                                                                                                                                                                                      },
                                                                                                                                                                                                                        "endTime":  {
                                                                                                                                                                                                                                        "title":  "End time",
                                                                                                                                                                                                                                        "type":  "string",
                                                                                                                                                                                                                                        "examples":  [
                                                                                                                                                                                                                                                         "2023-04-12T12:00Z",
                                                                                                                                                                                                                                                         "now"
                                                                                                                                                                                                                                                     ]
                                                                                                                                                                                                                                    }
                                                                                                                                                                                                                    },
                                                                                                                                                                                                     "required":  [
                                                                                                                                                                                                                      "startTime"
                                                                                                                                                                                                                  ]
                                                                                                                                                                                                 },
                                                                                                                                                                                   "numberOfViolations":  {
                                                                                                                                                                                                              "title":  "Number of violations",
                                                                                                                                                                                                              "description":  "Number of violations (anomalies) within an alert",
                                                                                                                                                                                                              "type":  "integer"
                                                                                                                                                                                                          },
                                                                                                                                                                                   "properties":  {
                                                                                                                                                                                                      "title":  "Properties",
                                                                                                                                                                                                      "description":  "List of properties describing in more detail given raised alert.",
                                                                                                                                                                                                      "type":  "array",
                                                                                                                                                                                                      "items":  {
                                                                                                                                                                                                                    "type":  "object",
                                                                                                                                                                                                                    "additionalProperties":  false,
                                                                                                                                                                                                                    "required":  [
                                                                                                                                                                                                                                     "key",
                                                                                                                                                                                                                                     "value"
                                                                                                                                                                                                                                 ],
                                                                                                                                                                                                                    "properties":  {
                                                                                                                                                                                                                                       "key":  {
                                                                                                                                                                                                                                                   "title":  "Key",
                                                                                                                                                                                                                                                   "description":  "Key of the property",
                                                                                                                                                                                                                                                   "type":  "string"
                                                                                                                                                                                                                                               },
                                                                                                                                                                                                                                       "value":  {
                                                                                                                                                                                                                                                     "title":  "Value",
                                                                                                                                                                                                                                                     "description":  "Value of the property",
                                                                                                                                                                                                                                                     "type":  "string"
                                                                                                                                                                                                                                                 }
                                                                                                                                                                                                                                   }
                                                                                                                                                                                                                }
                                                                                                                                                                                                  }
                                                                                                                                                                               }
                                                                                                                                                            }
                                                                                                                                              },
                                                                                                                             "dimensions":  {
                                                                                                                                                "title":  "Dimensions",
                                                                                                                                                "description":  "Dimension-tuples of the underlying time series",
                                                                                                                                                "type":  "array",
                                                                                                                                                "items":  {
                                                                                                                                                              "type":  "object",
                                                                                                                                                              "additionalProperties":  false,
                                                                                                                                                              "required":  [
                                                                                                                                                                               "key",
                                                                                                                                                                               "value"
                                                                                                                                                                           ],
                                                                                                                                                              "properties":  {
                                                                                                                                                                                 "key":  {
                                                                                                                                                                                             "title":  "Key",
                                                                                                                                                                                             "description":  "Key of the dimension",
                                                                                                                                                                                             "type":  "string"
                                                                                                                                                                                         },
                                                                                                                                                                                 "value":  {
                                                                                                                                                                                               "title":  "Value",
                                                                                                                                                                                               "description":  "Value of the dimension",
                                                                                                                                                                                               "type":  "string"
                                                                                                                                                                                           }
                                                                                                                                                                             }
                                                                                                                                                          }
                                                                                                                                            }
                                                                                                                         }
                                                                                                      }
                                                                                        },
                                                                             "logs":  {
                                                                                          "type":  "array",
                                                                                          "items":  {
                                                                                                        "level":  {
                                                                                                                      "title":  "level",
                                                                                                                      "type":  "string",
                                                                                                                      "anyOf":  [
                                                                                                                                    {
                                                                                                                                        "title":  "Tracing",
                                                                                                                                        "description":  "Tracing",
                                                                                                                                        "enum":  [
                                                                                                                                                     "TRACING"
                                                                                                                                                 ]
                                                                                                                                    },
                                                                                                                                    {
                                                                                                                                        "title":  "Info",
                                                                                                                                        "description":  "Info",
                                                                                                                                        "enum":  [
                                                                                                                                                     "INFO"
                                                                                                                                                 ]
                                                                                                                                    },
                                                                                                                                    {
                                                                                                                                        "title":  "Warning",
                                                                                                                                        "description":  "Warning",
                                                                                                                                        "enum":  [
                                                                                                                                                     "WARNING"
                                                                                                                                                 ]
                                                                                                                                    },
                                                                                                                                    {
                                                                                                                                        "title":  "Severe",
                                                                                                                                        "description":  "Severe",
                                                                                                                                        "enum":  [
                                                                                                                                                     "SEVERE"
                                                                                                                                                 ]
                                                                                                                                    }
                                                                                                                                ]
                                                                                                                  },
                                                                                                        "message":  {
                                                                                                                        "title":  "message",
                                                                                                                        "type":  "string"
                                                                                                                    },
                                                                                                        "analyzerName":  {
                                                                                                                             "title":  "analyzerName",
                                                                                                                             "type":  "string"
                                                                                                                         }
                                                                                                    }
                                                                                      },
                                                                             "data":  {
                                                                                          "type":  "array",
                                                                                          "items":  {
                                                                                                        "type":  "object",
                                                                                                        "required":  [
                                                                                                                         "query",
                                                                                                                         "value",
                                                                                                                         "type"
                                                                                                                     ],
                                                                                                        "properties":  {
                                                                                                                           "query":  {
                                                                                                                                         "oneOf":  [
                                                                                                                                                       {
                                                                                                                                                           "type":  "string"
                                                                                                                                                       },
                                                                                                                                                       {
                                                                                                                                                           "type":  "object"
                                                                                                                                                       }
                                                                                                                                                   ]
                                                                                                                                     },
                                                                                                                           "value":  {
                                                                                                                                         "type":  "object"
                                                                                                                                     },
                                                                                                                           "type":  {
                                                                                                                                        "type":  "string"
                                                                                                                                    }
                                                                                                                       }
                                                                                                    }
                                                                                      }
                                                                         }
                                                      },
                                     "annotations":  {
                                                         "title":  "Seasonal Baseline Agent",
                                                         "readOnlyHint":  true,
                                                         "destructiveHint":  false,
                                                         "idempotentHint":  false,
                                                         "openWorldHint":  false,
                                                         "returnDirect":  true
                                                     },
                                     "_meta":  {
                                                   "customerFacingDescription":  "Identify anomalies automatically against a metricâs historical seasonality patterns. Works best when Grail Query Agent is also enabled"
                                               }
                                 },
                                 {
                                     "name":  "static-threshold-analyzer",
                                     "title":  "Static Threshold Analysis Agent",
                                     "description":  "Detect anomalies by setting fixed thresholds for metrics that should not be violated.\nThe values used for \\\"violatingSamples\\\" and \\\"dealertingSamples\\\" must never be bigger then the value of \\\"slidingWindow\\\".\"\nThe \\\"threshold\\\" must always be set in the base unit of the metric queried in \\\"timeSeriesData\\\". In general, response time based metrics have a base unit of milliseconds. For example for queries on the \\\"dt.service.request.response_time\\\" metrica threshold of 5 seconds must be set as 5000.\"\nTimeframe for analysis should never be set in the future.\nIt is advisable to use the create-dql tool beforehand to get a valid DQL query as input for this tool.\n",
                                     "inputSchema":  {
                                                         "type":  "object",
                                                         "properties":  {
                                                                            "generalParameters":  {
                                                                                                      "title":  "General parameters",
                                                                                                      "description":  "General query parameter",
                                                                                                      "type":  "object",
                                                                                                      "additionalProperties":  true,
                                                                                                      "properties":  {
                                                                                                                         "timeframe":  {
                                                                                                                                           "title":  "Timeframe",
                                                                                                                                           "description":  "By default, the general timeframe for queries is the last 2 hours from now. If only a startTime is provided, the current time will be used as the endTime.",
                                                                                                                                           "type":  "object",
                                                                                                                                           "additionalProperties":  false,
                                                                                                                                           "properties":  {
                                                                                                                                                              "startTime":  {
                                                                                                                                                                                "title":  "Start time",
                                                                                                                                                                                "description":  "Supports absolute or relative timestamps. Specify an absolute time in the ISO 8601 (yyyy-MM-ddTHH:mm:ssZ) format or use a relative time such as \u0027now-2h\u0027. For relative timestamps only hours, minutes and days are allowed and are abbreviated as h, m and d respectively. Only lowercase input is accepted.",
                                                                                                                                                                                "type":  "string",
                                                                                                                                                                                "examples":  [
                                                                                                                                                                                                 "2023-04-10T12:00Z",
                                                                                                                                                                                                 "now-2h"
                                                                                                                                                                                             ],
                                                                                                                                                                                "default":  "now-2h"
                                                                                                                                                                            },
                                                                                                                                                              "endTime":  {
                                                                                                                                                                              "title":  "End time",
                                                                                                                                                                              "type":  "string",
                                                                                                                                                                              "examples":  [
                                                                                                                                                                                               "2023-04-12T12:00Z",
                                                                                                                                                                                               "now"
                                                                                                                                                                                           ],
                                                                                                                                                                              "default":  "now"
                                                                                                                                                                          }
                                                                                                                                                          },
                                                                                                                                           "required":  [
                                                                                                                                                            "startTime"
                                                                                                                                                        ]
                                                                                                                                       }
                                                                                                                     }
                                                                                                  },
                                                                            "timeSeriesData":  {
                                                                                                   "title":  "Time series data",
                                                                                                   "description":  "Time series data or query to analyze. Supports the Dynatrace Query Language (DQL).",
                                                                                                   "oneOf":  [
                                                                                                                 {
                                                                                                                     "type":  "string"
                                                                                                                 },
                                                                                                                 {
                                                                                                                     "type":  "object"
                                                                                                                 }
                                                                                                             ]
                                                                                               },
                                                                            "threshold":  {
                                                                                              "title":  "Threshold",
                                                                                              "type":  "number"
                                                                                          },
                                                                            "alertCondition":  {
                                                                                                   "title":  "Alert condition",
                                                                                                   "type":  "string",
                                                                                                   "anyOf":  [
                                                                                                                 {
                                                                                                                     "title":  "Alert if metric is below",
                                                                                                                     "description":  "Alert only if values are below a threshold.",
                                                                                                                     "enum":  [
                                                                                                                                  "BELOW"
                                                                                                                              ]
                                                                                                                 },
                                                                                                                 {
                                                                                                                     "title":  "Alert if metric is above",
                                                                                                                     "description":  "Alert only if values are above a threshold.",
                                                                                                                     "enum":  [
                                                                                                                                  "ABOVE"
                                                                                                                              ]
                                                                                                                 }
                                                                                                             ]
                                                                                               },
                                                                            "alertOnMissingData":  {
                                                                                                       "title":  "Alert on missing data",
                                                                                                       "description":  "The ability to set an alert on missing data in a metric. When enabled, missing data samples will be treated as violating samples. When disabled, missing data is not treated as a violation but will still contribute to dealerting. We recommend disabling alerting on missing data for sparse timeseries to avoid false alerts. To learn more, visit [anomaly detection configuration](https://dt-url.net/lz02mwi).",
                                                                                                       "type":  "boolean"
                                                                                                   },
                                                                            "violatingSamples":  {
                                                                                                     "title":  "Violating samples",
                                                                                                     "description":  "Total number of samples in the sliding window that must violate to trigger an event. Value must be between 1 and 60. The default value is 3.",
                                                                                                     "type":  "integer"
                                                                                                 },
                                                                            "slidingWindow":  {
                                                                                                  "title":  "Sliding window",
                                                                                                  "description":  "Total number of samples that form the sliding window. Value must be between 1 and 60. The default value is 5.",
                                                                                                  "type":  "integer"
                                                                                              },
                                                                            "dealertingSamples":  {
                                                                                                      "title":  "Dealerting samples",
                                                                                                      "description":  "Total number of samples in the sliding window that must go back to normal to close the event. Value must be between 1 and 60. The default value is 5.",
                                                                                                      "type":  "integer"
                                                                                                  }
                                                                        },
                                                         "required":  [
                                                                          "timeSeriesData",
                                                                          "threshold"
                                                                      ],
                                                         "additionalProperties":  false
                                                     },
                                     "outputSchema":  {
                                                          "title":  "Result for Static threshold anomaly detection",
                                                          "$schema":  "http://json-schema.org/draft-07/schema#",
                                                          "description":  "[Learn more](https://dt-url.net/ta5s0pxa)",
                                                          "type":  "object",
                                                          "additionalProperties":  false,
                                                          "required":  [
                                                                           "resultStatus",
                                                                           "executionStatus",
                                                                           "resultId",
                                                                           "output"
                                                                       ],
                                                          "properties":  {
                                                                             "resultStatus":  {
                                                                                                  "title":  "resultStatus",
                                                                                                  "type":  "string",
                                                                                                  "anyOf":  [
                                                                                                                {
                                                                                                                    "title":  "Successful",
                                                                                                                    "description":  "Successful result",
                                                                                                                    "enum":  [
                                                                                                                                 "SUCCESSFUL"
                                                                                                                             ]
                                                                                                                },
                                                                                                                {
                                                                                                                    "title":  "Successful with warnings",
                                                                                                                    "description":  "Successful result contains warnings",
                                                                                                                    "enum":  [
                                                                                                                                 "SUCCESSFUL_WITH_WARNINGS"
                                                                                                                             ]
                                                                                                                },
                                                                                                                {
                                                                                                                    "title":  "Failed",
                                                                                                                    "description":  "Failed result",
                                                                                                                    "enum":  [
                                                                                                                                 "FAILED"
                                                                                                                             ]
                                                                                                                }
                                                                                                            ]
                                                                                              },
                                                                             "executionStatus":  {
                                                                                                     "title":  "executionStatus",
                                                                                                     "type":  "string",
                                                                                                     "anyOf":  [
                                                                                                                   {
                                                                                                                       "title":  "Running",
                                                                                                                       "description":  "Execution still running",
                                                                                                                       "enum":  [
                                                                                                                                    "RUNNING"
                                                                                                                                ]
                                                                                                                   },
                                                                                                                   {
                                                                                                                       "title":  "Aborted",
                                                                                                                       "description":  "Execution manually canceled",
                                                                                                                       "enum":  [
                                                                                                                                    "ABORTED"
                                                                                                                                ]
                                                                                                                   },
                                                                                                                   {
                                                                                                                       "title":  "Completed",
                                                                                                                       "description":  "Execution completed",
                                                                                                                       "enum":  [
                                                                                                                                    "COMPLETED"
                                                                                                                                ]
                                                                                                                   }
                                                                                                               ]
                                                                                                 },
                                                                             "resultId":  {
                                                                                              "title":  "resultId",
                                                                                              "type":  "string"
                                                                                          },
                                                                             "input":  {
                                                                                           "type":  "object"
                                                                                       },
                                                                             "output":  {
                                                                                            "type":  "array",
                                                                                            "items":  {
                                                                                                          "type":  "object",
                                                                                                          "additionalProperties":  false,
                                                                                                          "required":  [
                                                                                                                           "analysisStatus",
                                                                                                                           "analyzedTimeSeriesQuery"
                                                                                                                       ],
                                                                                                          "properties":  {
                                                                                                                             "system":  {
                                                                                                                                            "title":  "System",
                                                                                                                                            "description":  "Output system parameters",
                                                                                                                                            "type":  "object",
                                                                                                                                            "additionalProperties":  false,
                                                                                                                                            "properties":  {
                                                                                                                                                               "logs":  {
                                                                                                                                                                            "title":  "Logs",
                                                                                                                                                                            "description":  "Logs connected to a specific output",
                                                                                                                                                                            "type":  "array",
                                                                                                                                                                            "items":  {
                                                                                                                                                                                          "type":  "object",
                                                                                                                                                                                          "additionalProperties":  false,
                                                                                                                                                                                          "required":  [
                                                                                                                                                                                                           "level",
                                                                                                                                                                                                           "message"
                                                                                                                                                                                                       ],
                                                                                                                                                                                          "properties":  {
                                                                                                                                                                                                             "level":  {
                                                                                                                                                                                                                           "title":  "Level",
                                                                                                                                                                                                                           "type":  "string",
                                                                                                                                                                                                                           "anyOf":  [
                                                                                                                                                                                                                                         {
                                                                                                                                                                                                                                             "title":  "Tracing",
                                                                                                                                                                                                                                             "description":  "Tracing",
                                                                                                                                                                                                                                             "enum":  [
                                                                                                                                                                                                                                                          "TRACING"
                                                                                                                                                                                                                                                      ]
                                                                                                                                                                                                                                         },
                                                                                                                                                                                                                                         {
                                                                                                                                                                                                                                             "title":  "Info",
                                                                                                                                                                                                                                             "description":  "Info",
                                                                                                                                                                                                                                             "enum":  [
                                                                                                                                                                                                                                                          "INFO"
                                                                                                                                                                                                                                                      ]
                                                                                                                                                                                                                                         },
                                                                                                                                                                                                                                         {
                                                                                                                                                                                                                                             "title":  "Warning",
                                                                                                                                                                                                                                             "description":  "Warning",
                                                                                                                                                                                                                                             "enum":  [
                                                                                                                                                                                                                                                          "WARNING"
                                                                                                                                                                                                                                                      ]
                                                                                                                                                                                                                                         }
                                                                                                                                                                                                                                     ]
                                                                                                                                                                                                                       },
                                                                                                                                                                                                             "message":  {
                                                                                                                                                                                                                             "title":  "Message",
                                                                                                                                                                                                                             "type":  "string"
                                                                                                                                                                                                                         }
                                                                                                                                                                                                         }
                                                                                                                                                                                      }
                                                                                                                                                                        }
                                                                                                                                                           }
                                                                                                                                        },
                                                                                                                             "analysisStatus":  {
                                                                                                                                                    "title":  "The status of an analysis",
                                                                                                                                                    "description":  "The status of an analysis of a particular univariate data.",
                                                                                                                                                    "type":  "string",
                                                                                                                                                    "anyOf":  [
                                                                                                                                                                  {
                                                                                                                                                                      "title":  "OK",
                                                                                                                                                                      "description":  "The analysis was performed successfully, the result is available.",
                                                                                                                                                                      "enum":  [
                                                                                                                                                                                   "OK"
                                                                                                                                                                               ]
                                                                                                                                                                  },
                                                                                                                                                                  {
                                                                                                                                                                      "title":  "Failed",
                                                                                                                                                                      "description":  "There was a problem during an analysis, the result is not available.",
                                                                                                                                                                      "enum":  [
                                                                                                                                                                                   "FAILED"
                                                                                                                                                                               ]
                                                                                                                                                                  }
                                                                                                                                                              ]
                                                                                                                                                },
                                                                                                                             "analyzedTimeSeriesQuery":  {
                                                                                                                                                             "title":  "Analyzed time series query",
                                                                                                                                                             "description":  "Time series query that corresponds to the analyzed univariate data.",
                                                                                                                                                             "oneOf":  [
                                                                                                                                                                           {
                                                                                                                                                                               "type":  "string"
                                                                                                                                                                           },
                                                                                                                                                                           {
                                                                                                                                                                               "type":  "object"
                                                                                                                                                                           }
                                                                                                                                                                       ]
                                                                                                                                                         },
                                                                                                                             "anomalyDetectorBounds":  {
                                                                                                                                                           "title":  "Bounds of anomaly detector",
                                                                                                                                                           "description":  "Bounds of anomaly detector in order to count a value as an anomaly. The bounds are reported as a multivariate time series data array with properties {dt.davis.anomaly_detection: lower}, {dt.davis.anomaly_detection: upper} or both on the respective columns.",
                                                                                                                                                           "type":  "object"
                                                                                                                                                       },
                                                                                                                             "raisedAlerts":  {
                                                                                                                                                  "title":  "Raised alerts",
                                                                                                                                                  "description":  "List of raised alerts found within the evaluation time frame",
                                                                                                                                                  "type":  "array",
                                                                                                                                                  "items":  {
                                                                                                                                                                "type":  "object",
                                                                                                                                                                "additionalProperties":  false,
                                                                                                                                                                "required":  [
                                                                                                                                                                                 "timeframe",
                                                                                                                                                                                 "numberOfViolations"
                                                                                                                                                                             ],
                                                                                                                                                                "properties":  {
                                                                                                                                                                                   "timeframe":  {
                                                                                                                                                                                                     "title":  "Timeframe",
                                                                                                                                                                                                     "description":  "Represents the start and end time of an alert, given in ms. If only a startTime is provided, the current time will be used as the endTime.",
                                                                                                                                                                                                     "type":  "object",
                                                                                                                                                                                                     "additionalProperties":  false,
                                                                                                                                                                                                     "properties":  {
                                                                                                                                                                                                                        "startTime":  {
                                                                                                                                                                                                                                          "title":  "Start time",
                                                                                                                                                                                                                                          "description":  "Supports absolute or relative timestamps. Specify an absolute time in the ISO 8601 (yyyy-MM-ddTHH:mm:ssZ) format or use a relative time such as \u0027now-2h\u0027. For relative timestamps only hours, minutes and days are allowed and are abbreviated as h, m and d respectively. Only lowercase input is accepted.",
                                                                                                                                                                                                                                          "type":  "string",
                                                                                                                                                                                                                                          "examples":  [
                                                                                                                                                                                                                                                           "2023-04-10T12:00Z",
                                                                                                                                                                                                                                                           "now-2h"
                                                                                                                                                                                                                                                       ]
                                                                                                                                                                                                                                      },
                                                                                                                                                                                                                        "endTime":  {
                                                                                                                                                                                                                                        "title":  "End time",
                                                                                                                                                                                                                                        "type":  "string",
                                                                                                                                                                                                                                        "examples":  [
                                                                                                                                                                                                                                                         "2023-04-12T12:00Z",
                                                                                                                                                                                                                                                         "now"
                                                                                                                                                                                                                                                     ]
                                                                                                                                                                                                                                    }
                                                                                                                                                                                                                    },
                                                                                                                                                                                                     "required":  [
                                                                                                                                                                                                                      "startTime"
                                                                                                                                                                                                                  ]
                                                                                                                                                                                                 },
                                                                                                                                                                                   "numberOfViolations":  {
                                                                                                                                                                                                              "title":  "Number of violations",
                                                                                                                                                                                                              "description":  "Number of violations (anomalies) within an alert",
                                                                                                                                                                                                              "type":  "integer"
                                                                                                                                                                                                          },
                                                                                                                                                                                   "properties":  {
                                                                                                                                                                                                      "title":  "Properties",
                                                                                                                                                                                                      "description":  "List of properties describing in more detail given raised alert.",
                                                                                                                                                                                                      "type":  "array",
                                                                                                                                                                                                      "items":  {
                                                                                                                                                                                                                    "type":  "object",
                                                                                                                                                                                                                    "additionalProperties":  false,
                                                                                                                                                                                                                    "required":  [
                                                                                                                                                                                                                                     "key",
                                                                                                                                                                                                                                     "value"
                                                                                                                                                                                                                                 ],
                                                                                                                                                                                                                    "properties":  {
                                                                                                                                                                                                                                       "key":  {
                                                                                                                                                                                                                                                   "title":  "Key",
                                                                                                                                                                                                                                                   "description":  "Key of the property",
                                                                                                                                                                                                                                                   "type":  "string"
                                                                                                                                                                                                                                               },
                                                                                                                                                                                                                                       "value":  {
                                                                                                                                                                                                                                                     "title":  "Value",
                                                                                                                                                                                                                                                     "description":  "Value of the property",
                                                                                                                                                                                                                                                     "type":  "string"
                                                                                                                                                                                                                                                 }
                                                                                                                                                                                                                                   }
                                                                                                                                                                                                                }
                                                                                                                                                                                                  }
                                                                                                                                                                               }
                                                                                                                                                            }
                                                                                                                                              },
                                                                                                                             "dimensions":  {
                                                                                                                                                "title":  "Dimensions",
                                                                                                                                                "description":  "Dimension-tuples of the underlying time series",
                                                                                                                                                "type":  "array",
                                                                                                                                                "items":  {
                                                                                                                                                              "type":  "object",
                                                                                                                                                              "additionalProperties":  false,
                                                                                                                                                              "required":  [
                                                                                                                                                                               "key",
                                                                                                                                                                               "value"
                                                                                                                                                                           ],
                                                                                                                                                              "properties":  {
                                                                                                                                                                                 "key":  {
                                                                                                                                                                                             "title":  "Key",
                                                                                                                                                                                             "description":  "Key of the dimension",
                                                                                                                                                                                             "type":  "string"
                                                                                                                                                                                         },
                                                                                                                                                                                 "value":  {
                                                                                                                                                                                               "title":  "Value",
                                                                                                                                                                                               "description":  "Value of the dimension",
                                                                                                                                                                                               "type":  "string"
                                                                                                                                                                                           }
                                                                                                                                                                             }
                                                                                                                                                          }
                                                                                                                                            }
                                                                                                                         }
                                                                                                      }
                                                                                        },
                                                                             "logs":  {
                                                                                          "type":  "array",
                                                                                          "items":  {
                                                                                                        "level":  {
                                                                                                                      "title":  "level",
                                                                                                                      "type":  "string",
                                                                                                                      "anyOf":  [
                                                                                                                                    {
                                                                                                                                        "title":  "Tracing",
                                                                                                                                        "description":  "Tracing",
                                                                                                                                        "enum":  [
                                                                                                                                                     "TRACING"
                                                                                                                                                 ]
                                                                                                                                    },
                                                                                                                                    {
                                                                                                                                        "title":  "Info",
                                                                                                                                        "description":  "Info",
                                                                                                                                        "enum":  [
                                                                                                                                                     "INFO"
                                                                                                                                                 ]
                                                                                                                                    },
                                                                                                                                    {
                                                                                                                                        "title":  "Warning",
                                                                                                                                        "description":  "Warning",
                                                                                                                                        "enum":  [
                                                                                                                                                     "WARNING"
                                                                                                                                                 ]
                                                                                                                                    },
                                                                                                                                    {
                                                                                                                                        "title":  "Severe",
                                                                                                                                        "description":  "Severe",
                                                                                                                                        "enum":  [
                                                                                                                                                     "SEVERE"
                                                                                                                                                 ]
                                                                                                                                    }
                                                                                                                                ]
                                                                                                                  },
                                                                                                        "message":  {
                                                                                                                        "title":  "message",
                                                                                                                        "type":  "string"
                                                                                                                    },
                                                                                                        "analyzerName":  {
                                                                                                                             "title":  "analyzerName",
                                                                                                                             "type":  "string"
                                                                                                                         }
                                                                                                    }
                                                                                      },
                                                                             "data":  {
                                                                                          "type":  "array",
                                                                                          "items":  {
                                                                                                        "type":  "object",
                                                                                                        "required":  [
                                                                                                                         "query",
                                                                                                                         "value",
                                                                                                                         "type"
                                                                                                                     ],
                                                                                                        "properties":  {
                                                                                                                           "query":  {
                                                                                                                                         "oneOf":  [
                                                                                                                                                       {
                                                                                                                                                           "type":  "string"
                                                                                                                                                       },
                                                                                                                                                       {
                                                                                                                                                           "type":  "object"
                                                                                                                                                       }
                                                                                                                                                   ]
                                                                                                                                     },
                                                                                                                           "value":  {
                                                                                                                                         "type":  "object"
                                                                                                                                     },
                                                                                                                           "type":  {
                                                                                                                                        "type":  "string"
                                                                                                                                    }
                                                                                                                       }
                                                                                                    }
                                                                                      }
                                                                         }
                                                      },
                                     "annotations":  {
                                                         "title":  "Static Threshold Analysis Agent",
                                                         "readOnlyHint":  true,
                                                         "destructiveHint":  false,
                                                         "idempotentHint":  false,
                                                         "openWorldHint":  false,
                                                         "returnDirect":  true
                                                     },
                                     "_meta":  {
                                                   "customerFacingDescription":  "Identify anomalies against fixed, unitâaccurate thresholds on any time series data. Works best when Grail Query Agent is also enabled"
                                               }
                                 },
                                 {
                                     "name":  "timeseries-forecast",
                                     "title":  "Forecasting Agent",
                                     "description":  "Predicts future time series values using a statistical forecasting model. This is based on historical data retrieved via a DQL query.\nForecast horizon has a maximum value of 600.\nTimeframe for analysis should never be set in the future.\nIt is advisable to use the create-dql tool beforehand to get a valid DQL query as input for this tool.\nQueries used as input for this analyzer should always limit the number of returned records. If the user does not ask for a specific limit, always set a limit of 500 records in the query. For example: \\\"timeseries avg(dt.service.request.response_time), by:{dt.entity.service} | limit 500\\\".\"\n",
                                     "inputSchema":  {
                                                         "type":  "object",
                                                         "properties":  {
                                                                            "generalParameters":  {
                                                                                                      "title":  "General parameters",
                                                                                                      "description":  "General query parameter",
                                                                                                      "type":  "object",
                                                                                                      "additionalProperties":  true,
                                                                                                      "properties":  {
                                                                                                                         "timeframe":  {
                                                                                                                                           "title":  "Timeframe",
                                                                                                                                           "description":  "By default, the general timeframe for queries is the last 2 hours from now. If only a startTime is provided, the current time will be used as the endTime.",
                                                                                                                                           "type":  "object",
                                                                                                                                           "additionalProperties":  false,
                                                                                                                                           "properties":  {
                                                                                                                                                              "startTime":  {
                                                                                                                                                                                "title":  "Start time",
                                                                                                                                                                                "description":  "Supports absolute or relative timestamps. Specify an absolute time in the ISO 8601 (yyyy-MM-ddTHH:mm:ssZ) format or use a relative time such as \u0027now-2h\u0027. For relative timestamps only hours, minutes and days are allowed and are abbreviated as h, m and d respectively. Only lowercase input is accepted.",
                                                                                                                                                                                "type":  "string",
                                                                                                                                                                                "examples":  [
                                                                                                                                                                                                 "2023-04-10T12:00Z",
                                                                                                                                                                                                 "now-2h"
                                                                                                                                                                                             ],
                                                                                                                                                                                "default":  "now-2h"
                                                                                                                                                                            },
                                                                                                                                                              "endTime":  {
                                                                                                                                                                              "title":  "End time",
                                                                                                                                                                              "type":  "string",
                                                                                                                                                                              "examples":  [
                                                                                                                                                                                               "2023-04-12T12:00Z",
                                                                                                                                                                                               "now"
                                                                                                                                                                                           ],
                                                                                                                                                                              "default":  "now"
                                                                                                                                                                          }
                                                                                                                                                          },
                                                                                                                                           "required":  [
                                                                                                                                                            "startTime"
                                                                                                                                                        ]
                                                                                                                                       }
                                                                                                                     }
                                                                                                  },
                                                                            "query":  {
                                                                                          "title":  "Query",
                                                                                          "description":  "Query that provides the time series which should be analyzed.",
                                                                                          "oneOf":  [
                                                                                                        {
                                                                                                            "type":  "string"
                                                                                                        },
                                                                                                        {
                                                                                                            "type":  "object"
                                                                                                        }
                                                                                                    ]
                                                                                      },
                                                                            "forecastHorizon":  {
                                                                                                    "title":  "Data points to predict",
                                                                                                    "description":  "Total steps the time series is forecasted. More steps generally results in less reliable forecasts and longer analyzer runtimes. Value must be between 1 and 600. The default value is 100.",
                                                                                                    "type":  "integer"
                                                                                                },
                                                                            "forecastOffset":  {
                                                                                                   "title":  "Forecast offset",
                                                                                                   "description":  "Offset for the start of the forecast. If e.g. the offset is 2, the last two data points will be ignored and a forecast for these points will be returned as well. Value must be between 0 and 10. The default value is 1.",
                                                                                                   "type":  "integer"
                                                                                               }
                                                                        },
                                                         "required":  [
                                                                          "query"
                                                                      ],
                                                         "additionalProperties":  false
                                                     },
                                     "outputSchema":  {
                                                          "title":  "Result for Forecast",
                                                          "$schema":  "http://json-schema.org/draft-07/schema#",
                                                          "description":  "[Learn more](https://dt-url.net/an03bbt)",
                                                          "type":  "object",
                                                          "additionalProperties":  false,
                                                          "required":  [
                                                                           "resultStatus",
                                                                           "executionStatus",
                                                                           "resultId",
                                                                           "output"
                                                                       ],
                                                          "properties":  {
                                                                             "resultStatus":  {
                                                                                                  "title":  "resultStatus",
                                                                                                  "type":  "string",
                                                                                                  "anyOf":  [
                                                                                                                {
                                                                                                                    "title":  "Successful",
                                                                                                                    "description":  "Successful result",
                                                                                                                    "enum":  [
                                                                                                                                 "SUCCESSFUL"
                                                                                                                             ]
                                                                                                                },
                                                                                                                {
                                                                                                                    "title":  "Successful with warnings",
                                                                                                                    "description":  "Successful result contains warnings",
                                                                                                                    "enum":  [
                                                                                                                                 "SUCCESSFUL_WITH_WARNINGS"
                                                                                                                             ]
                                                                                                                },
                                                                                                                {
                                                                                                                    "title":  "Failed",
                                                                                                                    "description":  "Failed result",
                                                                                                                    "enum":  [
                                                                                                                                 "FAILED"
                                                                                                                             ]
                                                                                                                }
                                                                                                            ]
                                                                                              },
                                                                             "executionStatus":  {
                                                                                                     "title":  "executionStatus",
                                                                                                     "type":  "string",
                                                                                                     "anyOf":  [
                                                                                                                   {
                                                                                                                       "title":  "Running",
                                                                                                                       "description":  "Execution still running",
                                                                                                                       "enum":  [
                                                                                                                                    "RUNNING"
                                                                                                                                ]
                                                                                                                   },
                                                                                                                   {
                                                                                                                       "title":  "Aborted",
                                                                                                                       "description":  "Execution manually canceled",
                                                                                                                       "enum":  [
                                                                                                                                    "ABORTED"
                                                                                                                                ]
                                                                                                                   },
                                                                                                                   {
                                                                                                                       "title":  "Completed",
                                                                                                                       "description":  "Execution completed",
                                                                                                                       "enum":  [
                                                                                                                                    "COMPLETED"
                                                                                                                                ]
                                                                                                                   }
                                                                                                               ]
                                                                                                 },
                                                                             "resultId":  {
                                                                                              "title":  "resultId",
                                                                                              "type":  "string"
                                                                                          },
                                                                             "input":  {
                                                                                           "type":  "object"
                                                                                       },
                                                                             "output":  {
                                                                                            "type":  "array",
                                                                                            "items":  {
                                                                                                          "type":  "object",
                                                                                                          "additionalProperties":  false,
                                                                                                          "required":  [
                                                                                                                           "resultTimeseries",
                                                                                                                           "analysisStatus"
                                                                                                                       ],
                                                                                                          "properties":  {
                                                                                                                             "system":  {
                                                                                                                                            "title":  "System",
                                                                                                                                            "description":  "Output system parameters",
                                                                                                                                            "type":  "object",
                                                                                                                                            "additionalProperties":  false,
                                                                                                                                            "properties":  {
                                                                                                                                                               "logs":  {
                                                                                                                                                                            "title":  "Logs",
                                                                                                                                                                            "description":  "Logs connected to a specific output",
                                                                                                                                                                            "type":  "array",
                                                                                                                                                                            "items":  {
                                                                                                                                                                                          "type":  "object",
                                                                                                                                                                                          "additionalProperties":  false,
                                                                                                                                                                                          "required":  [
                                                                                                                                                                                                           "level",
                                                                                                                                                                                                           "message"
                                                                                                                                                                                                       ],
                                                                                                                                                                                          "properties":  {
                                                                                                                                                                                                             "level":  {
                                                                                                                                                                                                                           "title":  "Level",
                                                                                                                                                                                                                           "type":  "string",
                                                                                                                                                                                                                           "anyOf":  [
                                                                                                                                                                                                                                         {
                                                                                                                                                                                                                                             "title":  "Tracing",
                                                                                                                                                                                                                                             "description":  "Tracing",
                                                                                                                                                                                                                                             "enum":  [
                                                                                                                                                                                                                                                          "TRACING"
                                                                                                                                                                                                                                                      ]
                                                                                                                                                                                                                                         },
                                                                                                                                                                                                                                         {
                                                                                                                                                                                                                                             "title":  "Info",
                                                                                                                                                                                                                                             "description":  "Info",
                                                                                                                                                                                                                                             "enum":  [
                                                                                                                                                                                                                                                          "INFO"
                                                                                                                                                                                                                                                      ]
                                                                                                                                                                                                                                         },
                                                                                                                                                                                                                                         {
                                                                                                                                                                                                                                             "title":  "Warning",
                                                                                                                                                                                                                                             "description":  "Warning",
                                                                                                                                                                                                                                             "enum":  [
                                                                                                                                                                                                                                                          "WARNING"
                                                                                                                                                                                                                                                      ]
                                                                                                                                                                                                                                         }
                                                                                                                                                                                                                                     ]
                                                                                                                                                                                                                       },
                                                                                                                                                                                                             "message":  {
                                                                                                                                                                                                                             "title":  "Message",
                                                                                                                                                                                                                             "type":  "string"
                                                                                                                                                                                                                         }
                                                                                                                                                                                                         }
                                                                                                                                                                                      }
                                                                                                                                                                        }
                                                                                                                                                           }
                                                                                                                                        },
                                                                                                                             "resultTimeseries":  {
                                                                                                                                                      "title":  "Result time series",
                                                                                                                                                      "description":  "A multivariate time series that contains the analyzed data and the generated forecasts. The columns containing the forecasts have the properties {dt.davis.forecast: lower, dt.davis.forecast: point, dt.davis.forecast: upper}.",
                                                                                                                                                      "type":  "object"
                                                                                                                                                  },
                                                                                                                             "timeseriesAnnotations":  {
                                                                                                                                                           "title":  "Annotations",
                                                                                                                                                           "description":  "Annotations for a time series. This structure annotates certain regions in a time series.",
                                                                                                                                                           "type":  "array",
                                                                                                                                                           "items":  {
                                                                                                                                                                         "type":  "object",
                                                                                                                                                                         "additionalProperties":  false,
                                                                                                                                                                         "required":  [
                                                                                                                                                                                          "start"
                                                                                                                                                                                      ],
                                                                                                                                                                         "properties":  {
                                                                                                                                                                                            "start":  {
                                                                                                                                                                                                          "title":  "Start",
                                                                                                                                                                                                          "description":  "The start timestamp of the annotation.",
                                                                                                                                                                                                          "type":  "string"
                                                                                                                                                                                                      },
                                                                                                                                                                                            "end":  {
                                                                                                                                                                                                        "title":  "End",
                                                                                                                                                                                                        "description":  "The end timestamp of the annotation.",
                                                                                                                                                                                                        "type":  "string"
                                                                                                                                                                                                    },
                                                                                                                                                                                            "title":  {
                                                                                                                                                                                                          "title":  "Title",
                                                                                                                                                                                                          "description":  "The title of the annotation.",
                                                                                                                                                                                                          "type":  "string"
                                                                                                                                                                                                      },
                                                                                                                                                                                            "description":  {
                                                                                                                                                                                                                "title":  "Description",
                                                                                                                                                                                                                "description":  "The description for the annotation.",
                                                                                                                                                                                                                "type":  "string"
                                                                                                                                                                                                            },
                                                                                                                                                                                            "annotationVariant":  {
                                                                                                                                                                                                                      "title":  "Annotation variant",
                                                                                                                                                                                                                      "description":  "Variant of the annotation.",
                                                                                                                                                                                                                      "type":  "string",
                                                                                                                                                                                                                      "anyOf":  [
                                                                                                                                                                                                                                    {
                                                                                                                                                                                                                                        "title":  "Info",
                                                                                                                                                                                                                                        "description":  "Information annotation",
                                                                                                                                                                                                                                        "enum":  [
                                                                                                                                                                                                                                                     "INFO"
                                                                                                                                                                                                                                                 ]
                                                                                                                                                                                                                                    },
                                                                                                                                                                                                                                    {
                                                                                                                                                                                                                                        "title":  "Warning",
                                                                                                                                                                                                                                        "description":  "Warning annotation",
                                                                                                                                                                                                                                        "enum":  [
                                                                                                                                                                                                                                                     "WARNING"
                                                                                                                                                                                                                                                 ]
                                                                                                                                                                                                                                    },
                                                                                                                                                                                                                                    {
                                                                                                                                                                                                                                        "title":  "Error",
                                                                                                                                                                                                                                        "description":  "Error annotation",
                                                                                                                                                                                                                                        "enum":  [
                                                                                                                                                                                                                                                     "ERROR"
                                                                                                                                                                                                                                                 ]
                                                                                                                                                                                                                                    }
                                                                                                                                                                                                                                ]
                                                                                                                                                                                                                  }
                                                                                                                                                                                        }
                                                                                                                                                                     }
                                                                                                                                                       },
                                                                                                                             "thresholds":  {
                                                                                                                                                "title":  "Thresholds",
                                                                                                                                                "description":  "Thresholds for a time series which mark an area on the y-axis of the series.",
                                                                                                                                                "type":  "array",
                                                                                                                                                "items":  {
                                                                                                                                                              "type":  "object",
                                                                                                                                                              "additionalProperties":  false,
                                                                                                                                                              "required":  [
                                                                                                                                                                               "thresholdVariant",
                                                                                                                                                                               "data"
                                                                                                                                                                           ],
                                                                                                                                                              "properties":  {
                                                                                                                                                                                 "label":  {
                                                                                                                                                                                               "title":  "Label",
                                                                                                                                                                                               "description":  "The label of the threshold.",
                                                                                                                                                                                               "type":  "string"
                                                                                                                                                                                           },
                                                                                                                                                                                 "strokeOnly":  {
                                                                                                                                                                                                    "title":  "Stroke only",
                                                                                                                                                                                                    "description":  "Whether to show the ranges filled or only the strokes of the bounds.",
                                                                                                                                                                                                    "type":  "boolean"
                                                                                                                                                                                                },
                                                                                                                                                                                 "thresholdVariant":  {
                                                                                                                                                                                                          "title":  "Threshold variant",
                                                                                                                                                                                                          "description":  "Variant of the Threshold.",
                                                                                                                                                                                                          "type":  "string",
                                                                                                                                                                                                          "anyOf":  [
                                                                                                                                                                                                                        {
                                                                                                                                                                                                                            "title":  "Info",
                                                                                                                                                                                                                            "description":  "Information threshold",
                                                                                                                                                                                                                            "enum":  [
                                                                                                                                                                                                                                         "INFO"
                                                                                                                                                                                                                                     ]
                                                                                                                                                                                                                        },
                                                                                                                                                                                                                        {
                                                                                                                                                                                                                            "title":  "Warning",
                                                                                                                                                                                                                            "description":  "Warning threshold",
                                                                                                                                                                                                                            "enum":  [
                                                                                                                                                                                                                                         "WARNING"
                                                                                                                                                                                                                                     ]
                                                                                                                                                                                                                        },
                                                                                                                                                                                                                        {
                                                                                                                                                                                                                            "title":  "Error",
                                                                                                                                                                                                                            "description":  "Error threshold",
                                                                                                                                                                                                                            "enum":  [
                                                                                                                                                                                                                                         "ERROR"
                                                                                                                                                                                                                                     ]
                                                                                                                                                                                                                        }
                                                                                                                                                                                                                    ]
                                                                                                                                                                                                      },
                                                                                                                                                                                 "data":  {
                                                                                                                                                                                              "title":  "Data points",
                                                                                                                                                                                              "description":  "The data points of the threshold. If only one data point is specified the threshold bounds are horizontal lines. When multiple data points are specified, the points act as change points for the threshold.",
                                                                                                                                                                                              "type":  "array",
                                                                                                                                                                                              "items":  {
                                                                                                                                                                                                            "type":  "object",
                                                                                                                                                                                                            "additionalProperties":  false,
                                                                                                                                                                                                            "required":  [
                                                                                                                                                                                                                             "min",
                                                                                                                                                                                                                             "max"
                                                                                                                                                                                                                         ],
                                                                                                                                                                                                            "properties":  {
                                                                                                                                                                                                                               "date":  {
                                                                                                                                                                                                                                            "title":  "Date",
                                                                                                                                                                                                                                            "description":  "The ISO datetime string of the threshold change point. If there exist multiple data points, the date is required.",
                                                                                                                                                                                                                                            "type":  "string"
                                                                                                                                                                                                                                        },
                                                                                                                                                                                                                               "min":  {
                                                                                                                                                                                                                                           "title":  "Lower bound",
                                                                                                                                                                                                                                           "description":  "The lower bound of the threshold. If there is no lower threshold, \u0027-Infinity\u0027 is returned instead. The default value is -Infinity.",
                                                                                                                                                                                                                                           "type":  [
                                                                                                                                                                                                                                                        "number",
                                                                                                                                                                                                                                                        "string"
                                                                                                                                                                                                                                                    ],
                                                                                                                                                                                                                                           "pattern":  "^(NaN|[-+]Infinity)$"
                                                                                                                                                                                                                                       },
                                                                                                                                                                                                                               "max":  {
                                                                                                                                                                                                                                           "title":  "Upper bound",
                                                                                                                                                                                                                                           "description":  "The upper bound of the threshold. If there is no lower threshold, \u0027Infinity\u0027 is returned instead. The default value is Infinity.",
                                                                                                                                                                                                                                           "type":  [
                                                                                                                                                                                                                                                        "number",
                                                                                                                                                                                                                                                        "string"
                                                                                                                                                                                                                                                    ],
                                                                                                                                                                                                                                           "pattern":  "^(NaN|[-+]Infinity)$"
                                                                                                                                                                                                                                       }
                                                                                                                                                                                                                           }
                                                                                                                                                                                                        }
                                                                                                                                                                                          }
                                                                                                                                                                             }
                                                                                                                                                          }
                                                                                                                                            },
                                                                                                                             "analysisStatus":  {
                                                                                                                                                    "title":  "Analysis status",
                                                                                                                                                    "description":  "The status of the analysis.",
                                                                                                                                                    "type":  "string",
                                                                                                                                                    "anyOf":  [
                                                                                                                                                                  {
                                                                                                                                                                      "title":  "Success",
                                                                                                                                                                      "description":  "The analysis of the time series was successful.",
                                                                                                                                                                      "enum":  [
                                                                                                                                                                                   "SUCCESS"
                                                                                                                                                                               ]
                                                                                                                                                                  },
                                                                                                                                                                  {
                                                                                                                                                                      "title":  "Failed",
                                                                                                                                                                      "description":  "The analysis of the time series failed.",
                                                                                                                                                                      "enum":  [
                                                                                                                                                                                   "FAILED"
                                                                                                                                                                               ]
                                                                                                                                                                  }
                                                                                                                                                              ]
                                                                                                                                                }
                                                                                                                         }
                                                                                                      }
                                                                                        },
                                                                             "logs":  {
                                                                                          "type":  "array",
                                                                                          "items":  {
                                                                                                        "level":  {
                                                                                                                      "title":  "level",
                                                                                                                      "type":  "string",
                                                                                                                      "anyOf":  [
                                                                                                                                    {
                                                                                                                                        "title":  "Tracing",
                                                                                                                                        "description":  "Tracing",
                                                                                                                                        "enum":  [
                                                                                                                                                     "TRACING"
                                                                                                                                                 ]
                                                                                                                                    },
                                                                                                                                    {
                                                                                                                                        "title":  "Info",
                                                                                                                                        "description":  "Info",
                                                                                                                                        "enum":  [
                                                                                                                                                     "INFO"
                                                                                                                                                 ]
                                                                                                                                    },
                                                                                                                                    {
                                                                                                                                        "title":  "Warning",
                                                                                                                                        "description":  "Warning",
                                                                                                                                        "enum":  [
                                                                                                                                                     "WARNING"
                                                                                                                                                 ]
                                                                                                                                    },
                                                                                                                                    {
                                                                                                                                        "title":  "Severe",
                                                                                                                                        "description":  "Severe",
                                                                                                                                        "enum":  [
                                                                                                                                                     "SEVERE"
                                                                                                                                                 ]
                                                                                                                                    }
                                                                                                                                ]
                                                                                                                  },
                                                                                                        "message":  {
                                                                                                                        "title":  "message",
                                                                                                                        "type":  "string"
                                                                                                                    },
                                                                                                        "analyzerName":  {
                                                                                                                             "title":  "analyzerName",
                                                                                                                             "type":  "string"
                                                                                                                         }
                                                                                                    }
                                                                                      },
                                                                             "data":  {
                                                                                          "type":  "array",
                                                                                          "items":  {
                                                                                                        "type":  "object",
                                                                                                        "required":  [
                                                                                                                         "query",
                                                                                                                         "value",
                                                                                                                         "type"
                                                                                                                     ],
                                                                                                        "properties":  {
                                                                                                                           "query":  {
                                                                                                                                         "oneOf":  [
                                                                                                                                                       {
                                                                                                                                                           "type":  "string"
                                                                                                                                                       },
                                                                                                                                                       {
                                                                                                                                                           "type":  "object"
                                                                                                                                                       }
                                                                                                                                                   ]
                                                                                                                                     },
                                                                                                                           "value":  {
                                                                                                                                         "type":  "object"
                                                                                                                                     },
                                                                                                                           "type":  {
                                                                                                                                        "type":  "string"
                                                                                                                                    }
                                                                                                                       }
                                                                                                    }
                                                                                      }
                                                                         }
                                                      },
                                     "annotations":  {
                                                         "title":  "Forecasting Agent",
                                                         "readOnlyHint":  true,
                                                         "destructiveHint":  false,
                                                         "idempotentHint":  false,
                                                         "openWorldHint":  false,
                                                         "returnDirect":  true
                                                     },
                                     "_meta":  {
                                                   "customerFacingDescription":  "Generate reliable forecasts for any time series data returned from running a DQL query, turning historical data into future predictions."
                                               }
                                 },
                                 {
                                     "name":  "timeseries-novelty-detection",
                                     "title":  "Changepoint Agent",
                                     "description":  "Analyze timeseries to find interesting events, like outliers (spikes), level changes, and significant trends.\nTimeframe for analysis should never be set in the future.\nIt is advisable to use the create-dql tool beforehand to get a valid DQL query as input for this tool.\n",
                                     "inputSchema":  {
                                                         "type":  "object",
                                                         "properties":  {
                                                                            "generalParameters":  {
                                                                                                      "title":  "General parameters",
                                                                                                      "description":  "General query parameter",
                                                                                                      "type":  "object",
                                                                                                      "additionalProperties":  true,
                                                                                                      "properties":  {
                                                                                                                         "timeframe":  {
                                                                                                                                           "title":  "Timeframe",
                                                                                                                                           "description":  "By default, the general timeframe for queries is the last 2 hours from now. If only a startTime is provided, the current time will be used as the endTime.",
                                                                                                                                           "type":  "object",
                                                                                                                                           "additionalProperties":  false,
                                                                                                                                           "properties":  {
                                                                                                                                                              "startTime":  {
                                                                                                                                                                                "title":  "Start time",
                                                                                                                                                                                "description":  "Supports absolute or relative timestamps. Specify an absolute time in the ISO 8601 (yyyy-MM-ddTHH:mm:ssZ) format or use a relative time such as \u0027now-2h\u0027. For relative timestamps only hours, minutes and days are allowed and are abbreviated as h, m and d respectively. Only lowercase input is accepted.",
                                                                                                                                                                                "type":  "string",
                                                                                                                                                                                "examples":  [
                                                                                                                                                                                                 "2023-04-10T12:00Z",
                                                                                                                                                                                                 "now-2h"
                                                                                                                                                                                             ],
                                                                                                                                                                                "default":  "now-2h"
                                                                                                                                                                            },
                                                                                                                                                              "endTime":  {
                                                                                                                                                                              "title":  "End time",
                                                                                                                                                                              "type":  "string",
                                                                                                                                                                              "examples":  [
                                                                                                                                                                                               "2023-04-12T12:00Z",
                                                                                                                                                                                               "now"
                                                                                                                                                                                           ],
                                                                                                                                                                              "default":  "now"
                                                                                                                                                                          }
                                                                                                                                                          },
                                                                                                                                           "required":  [
                                                                                                                                                            "startTime"
                                                                                                                                                        ]
                                                                                                                                       }
                                                                                                                     }
                                                                                                  },
                                                                            "timeSeriesData":  {
                                                                                                   "title":  "Time series data",
                                                                                                   "description":  "Time series data or query to analyze. Supports the Dynatrace Query Language (DQL).",
                                                                                                   "oneOf":  [
                                                                                                                 {
                                                                                                                     "type":  "string"
                                                                                                                 },
                                                                                                                 {
                                                                                                                     "type":  "object"
                                                                                                                 }
                                                                                                             ]
                                                                                               },
                                                                            "analysisNoveltyType":  {
                                                                                                        "title":  "Analyzed types of novelties",
                                                                                                        "description":  "Novelty types that should be included in the analysis.",
                                                                                                        "type":  "array",
                                                                                                        "items":  {
                                                                                                                      "type":  "string",
                                                                                                                      "anyOf":  [
                                                                                                                                    {
                                                                                                                                        "title":  "Change in values",
                                                                                                                                        "description":  "Significant change in values",
                                                                                                                                        "enum":  [
                                                                                                                                                     "CHANGE_IN_VALUES"
                                                                                                                                                 ]
                                                                                                                                    },
                                                                                                                                    {
                                                                                                                                        "title":  "Change in variability",
                                                                                                                                        "description":  "Significant change in variability",
                                                                                                                                        "enum":  [
                                                                                                                                                     "CHANGE_IN_VARIABILITY"
                                                                                                                                                 ]
                                                                                                                                    },
                                                                                                                                    {
                                                                                                                                        "title":  "Change in frequency of missing values",
                                                                                                                                        "description":  "Significant change in frequency of missing values",
                                                                                                                                        "enum":  [
                                                                                                                                                     "CHANGE_IN_MISSING_VALUES"
                                                                                                                                                 ]
                                                                                                                                    },
                                                                                                                                    {
                                                                                                                                        "title":  "Interval with missing values",
                                                                                                                                        "description":  "Larger interval with missing values",
                                                                                                                                        "enum":  [
                                                                                                                                                     "GAP_WITH_MISSING_VALUES"
                                                                                                                                                 ]
                                                                                                                                    },
                                                                                                                                    {
                                                                                                                                        "title":  "Trend in values",
                                                                                                                                        "description":  "Significant trend in values",
                                                                                                                                        "enum":  [
                                                                                                                                                     "TREND_IN_VALUES"
                                                                                                                                                 ]
                                                                                                                                    },
                                                                                                                                    {
                                                                                                                                        "title":  "Spike",
                                                                                                                                        "description":  "Significant short-term change in values",
                                                                                                                                        "enum":  [
                                                                                                                                                     "SPIKE"
                                                                                                                                                 ]
                                                                                                                                    }
                                                                                                                                ]
                                                                                                                  }
                                                                                                    },
                                                                            "detectionMode":  {
                                                                                                  "title":  "Detection mode",
                                                                                                  "description":  "Determines if the analyzer should only detect increases, only decreases or both",
                                                                                                  "type":  "string",
                                                                                                  "anyOf":  [
                                                                                                                {
                                                                                                                    "title":  "Decrease",
                                                                                                                    "description":  "Detect only a decrease",
                                                                                                                    "enum":  [
                                                                                                                                 "DECREASE"
                                                                                                                             ]
                                                                                                                },
                                                                                                                {
                                                                                                                    "title":  "Increase",
                                                                                                                    "description":  "Detect only a increase",
                                                                                                                    "enum":  [
                                                                                                                                 "INCREASE"
                                                                                                                             ]
                                                                                                                },
                                                                                                                {
                                                                                                                    "title":  "Increase and decrease",
                                                                                                                    "description":  "Detect a increase and decrease",
                                                                                                                    "enum":  [
                                                                                                                                 "ALL"
                                                                                                                             ]
                                                                                                                }
                                                                                                            ]
                                                                                              },
                                                                            "filterSpikes":  {
                                                                                                 "title":  "Filter detected spikes",
                                                                                                 "description":  "If enabled, detected spikes will be removed before further processing",
                                                                                                 "type":  "boolean"
                                                                                             },
                                                                            "minNoveltyScore":  {
                                                                                                    "title":  "Minimum required score",
                                                                                                    "description":  "Minimum required score for a novelty to be reported Value must be between 0.0 and 1.0. The default value is 0.45.",
                                                                                                    "type":  "number"
                                                                                                },
                                                                            "significanceLevel":  {
                                                                                                      "title":  "Analyzer certainty",
                                                                                                      "description":  "Defines the required level of significance for an analysis check",
                                                                                                      "type":  "string",
                                                                                                      "anyOf":  [
                                                                                                                    {
                                                                                                                        "title":  "High",
                                                                                                                        "description":  "Do checks with a high significance level",
                                                                                                                        "enum":  [
                                                                                                                                     "HIGH"
                                                                                                                                 ]
                                                                                                                    },
                                                                                                                    {
                                                                                                                        "title":  "Medium",
                                                                                                                        "description":  "Do checks with a medium significance level",
                                                                                                                        "enum":  [
                                                                                                                                     "MEDIUM"
                                                                                                                                 ]
                                                                                                                    },
                                                                                                                    {
                                                                                                                        "title":  "Low",
                                                                                                                        "description":  "Do checks with a low significance level",
                                                                                                                        "enum":  [
                                                                                                                                     "LOW"
                                                                                                                                 ]
                                                                                                                    }
                                                                                                                ]
                                                                                                  }
                                                                        },
                                                         "required":  [
                                                                          "timeSeriesData",
                                                                          "detectionMode"
                                                                      ],
                                                         "additionalProperties":  false
                                                     },
                                     "outputSchema":  {
                                                          "title":  "Result for Time series novelty analysis",
                                                          "$schema":  "http://json-schema.org/draft-07/schema#",
                                                          "description":  "Analyze time series and try to find interesting behaviour, e.g.: spikes, change points",
                                                          "type":  "object",
                                                          "additionalProperties":  false,
                                                          "required":  [
                                                                           "resultStatus",
                                                                           "executionStatus",
                                                                           "resultId",
                                                                           "output"
                                                                       ],
                                                          "properties":  {
                                                                             "resultStatus":  {
                                                                                                  "title":  "resultStatus",
                                                                                                  "type":  "string",
                                                                                                  "anyOf":  [
                                                                                                                {
                                                                                                                    "title":  "Successful",
                                                                                                                    "description":  "Successful result",
                                                                                                                    "enum":  [
                                                                                                                                 "SUCCESSFUL"
                                                                                                                             ]
                                                                                                                },
                                                                                                                {
                                                                                                                    "title":  "Successful with warnings",
                                                                                                                    "description":  "Successful result contains warnings",
                                                                                                                    "enum":  [
                                                                                                                                 "SUCCESSFUL_WITH_WARNINGS"
                                                                                                                             ]
                                                                                                                },
                                                                                                                {
                                                                                                                    "title":  "Failed",
                                                                                                                    "description":  "Failed result",
                                                                                                                    "enum":  [
                                                                                                                                 "FAILED"
                                                                                                                             ]
                                                                                                                }
                                                                                                            ]
                                                                                              },
                                                                             "executionStatus":  {
                                                                                                     "title":  "executionStatus",
                                                                                                     "type":  "string",
                                                                                                     "anyOf":  [
                                                                                                                   {
                                                                                                                       "title":  "Running",
                                                                                                                       "description":  "Execution still running",
                                                                                                                       "enum":  [
                                                                                                                                    "RUNNING"
                                                                                                                                ]
                                                                                                                   },
                                                                                                                   {
                                                                                                                       "title":  "Aborted",
                                                                                                                       "description":  "Execution manually canceled",
                                                                                                                       "enum":  [
                                                                                                                                    "ABORTED"
                                                                                                                                ]
                                                                                                                   },
                                                                                                                   {
                                                                                                                       "title":  "Completed",
                                                                                                                       "description":  "Execution completed",
                                                                                                                       "enum":  [
                                                                                                                                    "COMPLETED"
                                                                                                                                ]
                                                                                                                   }
                                                                                                               ]
                                                                                                 },
                                                                             "resultId":  {
                                                                                              "title":  "resultId",
                                                                                              "type":  "string"
                                                                                          },
                                                                             "input":  {
                                                                                           "type":  "object"
                                                                                       },
                                                                             "output":  {
                                                                                            "type":  "array",
                                                                                            "items":  {
                                                                                                          "type":  "object",
                                                                                                          "additionalProperties":  false,
                                                                                                          "required":  [
                                                                                                                           "analysisStatus",
                                                                                                                           "analyzedTimeSeriesQuery"
                                                                                                                       ],
                                                                                                          "properties":  {
                                                                                                                             "system":  {
                                                                                                                                            "title":  "System",
                                                                                                                                            "description":  "Output system parameters",
                                                                                                                                            "type":  "object",
                                                                                                                                            "additionalProperties":  false,
                                                                                                                                            "properties":  {
                                                                                                                                                               "logs":  {
                                                                                                                                                                            "title":  "Logs",
                                                                                                                                                                            "description":  "Logs connected to a specific output",
                                                                                                                                                                            "type":  "array",
                                                                                                                                                                            "items":  {
                                                                                                                                                                                          "type":  "object",
                                                                                                                                                                                          "additionalProperties":  false,
                                                                                                                                                                                          "required":  [
                                                                                                                                                                                                           "level",
                                                                                                                                                                                                           "message"
                                                                                                                                                                                                       ],
                                                                                                                                                                                          "properties":  {
                                                                                                                                                                                                             "level":  {
                                                                                                                                                                                                                           "title":  "Level",
                                                                                                                                                                                                                           "type":  "string",
                                                                                                                                                                                                                           "anyOf":  [
                                                                                                                                                                                                                                         {
                                                                                                                                                                                                                                             "title":  "Tracing",
                                                                                                                                                                                                                                             "description":  "Tracing",
                                                                                                                                                                                                                                             "enum":  [
                                                                                                                                                                                                                                                          "TRACING"
                                                                                                                                                                                                                                                      ]
                                                                                                                                                                                                                                         },
                                                                                                                                                                                                                                         {
                                                                                                                                                                                                                                             "title":  "Info",
                                                                                                                                                                                                                                             "description":  "Info",
                                                                                                                                                                                                                                             "enum":  [
                                                                                                                                                                                                                                                          "INFO"
                                                                                                                                                                                                                                                      ]
                                                                                                                                                                                                                                         },
                                                                                                                                                                                                                                         {
                                                                                                                                                                                                                                             "title":  "Warning",
                                                                                                                                                                                                                                             "description":  "Warning",
                                                                                                                                                                                                                                             "enum":  [
                                                                                                                                                                                                                                                          "WARNING"
                                                                                                                                                                                                                                                      ]
                                                                                                                                                                                                                                         }
                                                                                                                                                                                                                                     ]
                                                                                                                                                                                                                       },
                                                                                                                                                                                                             "message":  {
                                                                                                                                                                                                                             "title":  "Message",
                                                                                                                                                                                                                             "type":  "string"
                                                                                                                                                                                                                         }
                                                                                                                                                                                                         }
                                                                                                                                                                                      }
                                                                                                                                                                        }
                                                                                                                                                           }
                                                                                                                                        },
                                                                                                                             "novelties":  {
                                                                                                                                               "title":  "Novelties",
                                                                                                                                               "description":  "List of novelties found within the analysis time frame",
                                                                                                                                               "type":  "array",
                                                                                                                                               "items":  {
                                                                                                                                                             "type":  "object",
                                                                                                                                                             "additionalProperties":  false,
                                                                                                                                                             "required":  [
                                                                                                                                                                              "timeframe",
                                                                                                                                                                              "noveltyDescription",
                                                                                                                                                                              "noveltyScore",
                                                                                                                                                                              "noveltyType"
                                                                                                                                                                          ],
                                                                                                                                                             "properties":  {
                                                                                                                                                                                "timeframe":  {
                                                                                                                                                                                                  "title":  "Timeframe",
                                                                                                                                                                                                  "description":  "Represents the start and end time of a novelty, given in ms. If only a startTime is provided, the current time will be used as the endTime.",
                                                                                                                                                                                                  "type":  "object",
                                                                                                                                                                                                  "additionalProperties":  false,
                                                                                                                                                                                                  "properties":  {
                                                                                                                                                                                                                     "startTime":  {
                                                                                                                                                                                                                                       "title":  "Start time",
                                                                                                                                                                                                                                       "description":  "Supports absolute or relative timestamps. Specify an absolute time in the ISO 8601 (yyyy-MM-ddTHH:mm:ssZ) format or use a relative time such as \u0027now-2h\u0027. For relative timestamps only hours, minutes and days are allowed and are abbreviated as h, m and d respectively. Only lowercase input is accepted.",
                                                                                                                                                                                                                                       "type":  "string",
                                                                                                                                                                                                                                       "examples":  [
                                                                                                                                                                                                                                                        "2023-04-10T12:00Z",
                                                                                                                                                                                                                                                        "now-2h"
                                                                                                                                                                                                                                                    ]
                                                                                                                                                                                                                                   },
                                                                                                                                                                                                                     "endTime":  {
                                                                                                                                                                                                                                     "title":  "End time",
                                                                                                                                                                                                                                     "type":  "string",
                                                                                                                                                                                                                                     "examples":  [
                                                                                                                                                                                                                                                      "2023-04-12T12:00Z",
                                                                                                                                                                                                                                                      "now"
                                                                                                                                                                                                                                                  ]
                                                                                                                                                                                                                                 }
                                                                                                                                                                                                                 },
                                                                                                                                                                                                  "required":  [
                                                                                                                                                                                                                   "startTime"
                                                                                                                                                                                                               ]
                                                                                                                                                                                              },
                                                                                                                                                                                "noveltyDescription":  {
                                                                                                                                                                                                           "title":  "Novelty description",
                                                                                                                                                                                                           "description":  "Provides human-readable description of the detected novelty.",
                                                                                                                                                                                                           "type":  "string"
                                                                                                                                                                                                       },
                                                                                                                                                                                "noveltyScore":  {
                                                                                                                                                                                                     "title":  "Novelty score",
                                                                                                                                                                                                     "description":  "Summarized novelty score.",
                                                                                                                                                                                                     "type":  [
                                                                                                                                                                                                                  "number",
                                                                                                                                                                                                                  "string"
                                                                                                                                                                                                              ],
                                                                                                                                                                                                     "pattern":  "^(NaN|[-+]Infinity)$"
                                                                                                                                                                                                 },
                                                                                                                                                                                "noveltyType":  {
                                                                                                                                                                                                    "title":  "Analyzed types of novelties",
                                                                                                                                                                                                    "description":  "Novelty types that should be included in the analysis.",
                                                                                                                                                                                                    "type":  "string",
                                                                                                                                                                                                    "anyOf":  [
                                                                                                                                                                                                                  {
                                                                                                                                                                                                                      "title":  "Change in values",
                                                                                                                                                                                                                      "description":  "Significant change in values",
                                                                                                                                                                                                                      "enum":  [
                                                                                                                                                                                                                                   "CHANGE_IN_VALUES"
                                                                                                                                                                                                                               ]
                                                                                                                                                                                                                  },
                                                                                                                                                                                                                  {
                                                                                                                                                                                                                      "title":  "Change in variability",
                                                                                                                                                                                                                      "description":  "Significant change in variability",
                                                                                                                                                                                                                      "enum":  [
                                                                                                                                                                                                                                   "CHANGE_IN_VARIABILITY"
                                                                                                                                                                                                                               ]
                                                                                                                                                                                                                  },
                                                                                                                                                                                                                  {
                                                                                                                                                                                                                      "title":  "Change in frequency of missing values",
                                                                                                                                                                                                                      "description":  "Significant change in frequency of missing values",
                                                                                                                                                                                                                      "enum":  [
                                                                                                                                                                                                                                   "CHANGE_IN_MISSING_VALUES"
                                                                                                                                                                                                                               ]
                                                                                                                                                                                                                  },
                                                                                                                                                                                                                  {
                                                                                                                                                                                                                      "title":  "Interval with missing values",
                                                                                                                                                                                                                      "description":  "Larger interval with missing values",
                                                                                                                                                                                                                      "enum":  [
                                                                                                                                                                                                                                   "GAP_WITH_MISSING_VALUES"
                                                                                                                                                                                                                               ]
                                                                                                                                                                                                                  },
                                                                                                                                                                                                                  {
                                                                                                                                                                                                                      "title":  "Trend in values",
                                                                                                                                                                                                                      "description":  "Significant trend in values",
                                                                                                                                                                                                                      "enum":  [
                                                                                                                                                                                                                                   "TREND_IN_VALUES"
                                                                                                                                                                                                                               ]
                                                                                                                                                                                                                  },
                                                                                                                                                                                                                  {
                                                                                                                                                                                                                      "title":  "Spike",
                                                                                                                                                                                                                      "description":  "Significant short-term change in values",
                                                                                                                                                                                                                      "enum":  [
                                                                                                                                                                                                                                   "SPIKE"
                                                                                                                                                                                                                               ]
                                                                                                                                                                                                                  }
                                                                                                                                                                                                              ]
                                                                                                                                                                                                }
                                                                                                                                                                            }
                                                                                                                                                         }
                                                                                                                                           },
                                                                                                                             "dimensions":  {
                                                                                                                                                "title":  "Dimensions",
                                                                                                                                                "description":  "Dimension-tuples of the underlying time series",
                                                                                                                                                "type":  "array",
                                                                                                                                                "items":  {
                                                                                                                                                              "type":  "object",
                                                                                                                                                              "additionalProperties":  false,
                                                                                                                                                              "required":  [
                                                                                                                                                                               "key",
                                                                                                                                                                               "value"
                                                                                                                                                                           ],
                                                                                                                                                              "properties":  {
                                                                                                                                                                                 "key":  {
                                                                                                                                                                                             "title":  "Key",
                                                                                                                                                                                             "description":  "Key of the dimension",
                                                                                                                                                                                             "type":  "string"
                                                                                                                                                                                         },
                                                                                                                                                                                 "value":  {
                                                                                                                                                                                               "title":  "Value",
                                                                                                                                                                                               "description":  "Value of the dimension",
                                                                                                                                                                                               "type":  "string"
                                                                                                                                                                                           }
                                                                                                                                                                             }
                                                                                                                                                          }
                                                                                                                                            },
                                                                                                                             "analysisStatus":  {
                                                                                                                                                    "title":  "The status of an analysis",
                                                                                                                                                    "description":  "The status of an analysis of a particular univariate data.",
                                                                                                                                                    "type":  "string",
                                                                                                                                                    "anyOf":  [
                                                                                                                                                                  {
                                                                                                                                                                      "title":  "OK",
                                                                                                                                                                      "description":  "The analysis was performed successfully, the result is available.",
                                                                                                                                                                      "enum":  [
                                                                                                                                                                                   "OK"
                                                                                                                                                                               ]
                                                                                                                                                                  },
                                                                                                                                                                  {
                                                                                                                                                                      "title":  "Failed",
                                                                                                                                                                      "description":  "There was a problem during an analysis, the result is not available.",
                                                                                                                                                                      "enum":  [
                                                                                                                                                                                   "FAILED"
                                                                                                                                                                               ]
                                                                                                                                                                  }
                                                                                                                                                              ]
                                                                                                                                                },
                                                                                                                             "analyzedTimeSeriesQuery":  {
                                                                                                                                                             "title":  "Analyzed time series query",
                                                                                                                                                             "description":  "Time series query that corresponds to the analyzed univariate data.",
                                                                                                                                                             "oneOf":  [
                                                                                                                                                                           {
                                                                                                                                                                               "type":  "string"
                                                                                                                                                                           },
                                                                                                                                                                           {
                                                                                                                                                                               "type":  "object"
                                                                                                                                                                           }
                                                                                                                                                                       ]
                                                                                                                                                         }
                                                                                                                         }
                                                                                                      }
                                                                                        },
                                                                             "logs":  {
                                                                                          "type":  "array",
                                                                                          "items":  {
                                                                                                        "level":  {
                                                                                                                      "title":  "level",
                                                                                                                      "type":  "string",
                                                                                                                      "anyOf":  [
                                                                                                                                    {
                                                                                                                                        "title":  "Tracing",
                                                                                                                                        "description":  "Tracing",
                                                                                                                                        "enum":  [
                                                                                                                                                     "TRACING"
                                                                                                                                                 ]
                                                                                                                                    },
                                                                                                                                    {
                                                                                                                                        "title":  "Info",
                                                                                                                                        "description":  "Info",
                                                                                                                                        "enum":  [
                                                                                                                                                     "INFO"
                                                                                                                                                 ]
                                                                                                                                    },
                                                                                                                                    {
                                                                                                                                        "title":  "Warning",
                                                                                                                                        "description":  "Warning",
                                                                                                                                        "enum":  [
                                                                                                                                                     "WARNING"
                                                                                                                                                 ]
                                                                                                                                    },
                                                                                                                                    {
                                                                                                                                        "title":  "Severe",
                                                                                                                                        "description":  "Severe",
                                                                                                                                        "enum":  [
                                                                                                                                                     "SEVERE"
                                                                                                                                                 ]
                                                                                                                                    }
                                                                                                                                ]
                                                                                                                  },
                                                                                                        "message":  {
                                                                                                                        "title":  "message",
                                                                                                                        "type":  "string"
                                                                                                                    },
                                                                                                        "analyzerName":  {
                                                                                                                             "title":  "analyzerName",
                                                                                                                             "type":  "string"
                                                                                                                         }
                                                                                                    }
                                                                                      },
                                                                             "data":  {
                                                                                          "type":  "array",
                                                                                          "items":  {
                                                                                                        "type":  "object",
                                                                                                        "required":  [
                                                                                                                         "query",
                                                                                                                         "value",
                                                                                                                         "type"
                                                                                                                     ],
                                                                                                        "properties":  {
                                                                                                                           "query":  {
                                                                                                                                         "oneOf":  [
                                                                                                                                                       {
                                                                                                                                                           "type":  "string"
                                                                                                                                                       },
                                                                                                                                                       {
                                                                                                                                                           "type":  "object"
                                                                                                                                                       }
                                                                                                                                                   ]
                                                                                                                                     },
                                                                                                                           "value":  {
                                                                                                                                         "type":  "object"
                                                                                                                                     },
                                                                                                                           "type":  {
                                                                                                                                        "type":  "string"
                                                                                                                                    }
                                                                                                                       }
                                                                                                    }
                                                                                      }
                                                                         }
                                                      },
                                     "annotations":  {
                                                         "title":  "Changepoint Agent",
                                                         "readOnlyHint":  true,
                                                         "destructiveHint":  false,
                                                         "idempotentHint":  false,
                                                         "openWorldHint":  false,
                                                         "returnDirect":  true
                                                     },
                                     "_meta":  {
                                                   "customerFacingDescription":  "Identify outliers, level changes, and meaningful trends in time series data. Works best when Grail Query Agent is also enabled"
                                               }
                                 }
                             ]
               }
}
