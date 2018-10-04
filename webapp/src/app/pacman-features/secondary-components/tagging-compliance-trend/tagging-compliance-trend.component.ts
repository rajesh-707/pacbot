/*
 *Copyright 2018 T Mobile, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); You may not use
 * this file except in compliance with the License. A copy of the License is located at
 * 
 * http://www.apache.org/licenses/LICENSE-2.0
 * 
 * or in the "license" file accompanying this file. This file is distributed on
 * an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, express or
 * implied. See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Component, OnInit, ViewEncapsulation, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { ComplianceOverviewService } from '../../services/compliance-overview.service';
import { Subscription } from 'rxjs/Subscription';
import { AssetGroupObservableService } from '../../../core/services/asset-group-observable.service';
import { SelectComplianceDropdown } from '../../services/select-compliance-dropdown.service';
import { LoggerService } from '../../../shared/services/logger.service';
import { ErrorHandlingService } from '../../../shared/services/error-handling.service';
import { environment } from './../../../../environments/environment';
import {AutorefreshService} from '../../services/autorefresh.service';

@Component({
  selector: 'app-tagging-compliance-trend',
  templateUrl: './tagging-compliance-trend.component.html',
  styleUrls: ['./tagging-compliance-trend.component.css'],
  providers: [ ComplianceOverviewService, AutorefreshService ],
  encapsulation: ViewEncapsulation.None,
  // tslint:disable-next-line:use-host-property-decorator
  host: {
    '(window:resize)': 'onResize($event)'
  }
})

export class TaggingComplianceTrendComponent implements OnInit, OnDestroy {

  @ViewChild('taggingComplianceOverviewContainer') widgetContainer: ElementRef;

  private assetGroupSubscription: Subscription;
  private complianceDropdownSubscription: Subscription;
  private issuesSubscription: Subscription;
  private selectedAssetGroup: any = 'rebellion';

  private graphWidth: any;
  private graphData: any;
  private dataLoaded: any = false;
  private error: any = false;
  private loading: any = false;
  private errorMessage: any = 'apiResponseError';
  private distributedFiltersObject: any = {};

  // Graph customization variables
  private yAxisLabel = 'Compliance %';
  private showGraphLegend = true;
  private showArea = false;
  private singlePercentLine = true;

  private autorefreshInterval;

  durationParams: any;
    autoRefresh: boolean;

  constructor(private complianceOverviewService: ComplianceOverviewService,
              private assetGroupObservableService: AssetGroupObservableService,
              private selectComplianceDropdown: SelectComplianceDropdown,
              private autorefreshService: AutorefreshService,
              private logger: LoggerService, private errorHandling: ErrorHandlingService) {

        // Get latest asset group selected and re-plot the graph
        this.assetGroupSubscription = this.assetGroupObservableService.getAssetGroup().subscribe(
            assetGroupName => {
                this.selectedAssetGroup = assetGroupName;
                this.init();
            });

        // Get latest targetType/Application/Environment
        this.complianceDropdownSubscription = this.selectComplianceDropdown.getCompliance().subscribe(
            distributedFiltersObject => {
                this.distributedFiltersObject = distributedFiltersObject;
            });
  }


  onResize() {
      const element = document.getElementById('taggingComplianceOverview');
      if (element) {
          this.graphWidth = parseInt((window.getComputedStyle(element, null).getPropertyValue('width')).split('px')[0], 10);
      }
  }

  getOverview() {
      try {

        if (this.issuesSubscription) {
          this.issuesSubscription.unsubscribe();
        }

          const complianceOverviewUrl = environment.taggingComplianceTrend.url;
          const method = environment.taggingComplianceTrend.method;

          const today = new Date();
          let  fromDay;
          if (today.getMonth() === 0) {
            fromDay = (today.getFullYear() - 1) + '-' + 12 + '-' + today.getDate();
          } else {
              fromDay = today.getFullYear() + '-' + today.getMonth() + '-' + today.getDate();
          }

          const queryParameters = {
              'ag': this.selectedAssetGroup,
              'from': fromDay,
              'filters': {}
          };

          this.issuesSubscription = this.complianceOverviewService.getWeeklyData(complianceOverviewUrl, method, queryParameters).subscribe(
              response => {
                  try {

                    if (response.length) {
                      response.forEach(type => {
                        const key = type.key.toLowerCase();
                        if (key === 'compliance_percent') {
                            this.graphData = [type];
                        }
                      });

                      this.setDataLoaded();
                    } else {
                      this.setError('noDataAvailable');
                    }

                  } catch (error) {
                      this.setError('jsError');
                  }
              },
              error => {
                  this.setError('apiResponseError');
              }
          );
      } catch (error) {
          this.setError('jsError');
      }
  }


  getData() {
      this.getOverview();
  }

  init() {
      this.setDataLoading();
      this.getData();
  }

  setDataLoaded() {
      this.dataLoaded = true;
      this.error = false;
      this.loading = false;
  }

  setDataLoading() {
      this.dataLoaded = false;
      this.error = false;
      this.loading = true;
  }

  setError(message?: any) {
      this.dataLoaded = false;
      this.error = true;
      this.loading = false;
      if (message) {
          this.errorMessage = message;
      }
  }

  ngOnInit() {

      this.durationParams = this.autorefreshService.getDuration();
      this.durationParams = parseInt(this.durationParams, 10);
      this.autoRefresh = this.autorefreshService.autoRefresh;

      const afterLoad = this;
        if (this.autoRefresh !== undefined) {
          if ((this.autoRefresh === true ) || (this.autoRefresh.toString() === 'true')) {

            this.autorefreshInterval = setInterval(function() {
              afterLoad.getData();
            }, this.durationParams);
          }
        }

      try {
          this.graphWidth = parseInt(window.getComputedStyle(this.widgetContainer.nativeElement, null).getPropertyValue('width'), 10);
      } catch (error) {
          this.errorMessage = this.errorHandling.handleJavascriptError(error);
          this.setError(error);
      }
  }

  ngOnDestroy() {
      try {
          this.issuesSubscription.unsubscribe();
          this.assetGroupSubscription.unsubscribe();
          this.complianceDropdownSubscription.unsubscribe();
          clearInterval(this.autorefreshInterval);
      } catch (error) {
          this.logger.log('error', '--- Error while unsubscribing ---');
      }
  }

}

