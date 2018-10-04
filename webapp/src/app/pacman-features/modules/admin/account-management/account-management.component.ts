import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { Subscription } from 'rxjs/Subscription';

import { environment } from './../../../../../environments/environment';
import { WorkflowService } from '../../../../core/services/workflow.service';
import { LoggerService } from '../../../../shared/services/logger.service';
import { DataCacheService } from '../../../../core/services/data-cache.service';
import { FilterManagementService } from '../../../../shared/services/filter-management.service';
import { ErrorHandlingService } from '../../../../shared/services/error-handling.service';
import { UtilsService } from '../../../../shared/services/utils.service';
import { RouterUtilityService } from '../../../../shared/services/router-utility.service';
import { CommonResponseService } from '../../../../shared/services/common-response.service';
import { RefactorFieldsService } from '../../../../shared/services/refactor-fields.service';


@Component({
  selector: 'app-account-management',
  templateUrl: './account-management.component.html',
  styleUrls: ['./account-management.component.css']
})
export class AccountManagementComponent implements OnInit, OnDestroy {

  pageTitle: String = 'Account Management';
  breadcrumbDetails = {
    breadcrumbArray: ['Admin'],
    breadcrumbLinks: ['policies'],
    breadcrumbPresent: 'Account Management'
  };
  backButtonRequired: boolean;
  pageLevel = 0;
  errorMessage = 'apiResponseError';
  searchPassed = '';
  agAndDomain = {};
  totalRows = 0;
  errorValue = 0;
  currentId;
  currentBucket: any = [];
  outerArr = [];
  bucketNumber = 0;
  showConfBox = false;
  firstPaginator = 1;
  allColumns = [];
  lastPaginator: number;
  currentPointer = 0;
  actionsArr = ['Edit', 'Delete'];
  paginatorSize = 25;
  searchTxt = '';

  tableSubscription: Subscription;
  assetGroupSubscription: Subscription;
  domainSubscription: Subscription;

  isFilterRquiredOnPage = false;
  appliedFilters = {
    queryParamsWithoutFilter: {}, /* Stores the query parameter ibject without filter */
    pageLevelAppliedFilters: {} /* Stores the query parameter ibject without filter */
  };
  filterArray = []; /* Stores the page applied filter array */
  routeSubscription: Subscription;

  constructor(private router: Router,
    private activatedRoute: ActivatedRoute,
    private workflowService: WorkflowService,
    private commonResponseService: CommonResponseService,
    private logger: LoggerService,
    private dataStore: DataCacheService,
    private filterManagementService: FilterManagementService,
    private errorHandling: ErrorHandlingService,
    private utils: UtilsService,
    private routerUtilityService: RouterUtilityService,
    private refactorFieldsService: RefactorFieldsService) {

    /* Check route parameter */
    this.routeSubscription = this.activatedRoute.params.subscribe(params => {
      // Fetch the required params from this object.
      console.log('params:', params);
    });

  }

  ngOnInit() {
    this.backButtonRequired = this.workflowService.checkIfFlowExistsCurrently(this.pageLevel);
    this.reset();
    this.init();
  }

  reset() {
    /* Reset the page */
    this.filterArray = [];
    this.outerArr = [];
    this.searchTxt = '';
    this.currentBucket = [];
    this.bucketNumber = 0;
    this.firstPaginator = 1;
    this.currentPointer = 0;
    this.allColumns = [];
    this.errorValue = 0;
  }

  init() {
    /* Initialize */
    this.routerParam();
    this.updateComponent();
  }

  updateComponent() {
    /* Updates the whole component */
    this.reset();
    this.getData();

  }

  routerParam() {
    try {

      const currentQueryParams = this.routerUtilityService.getQueryParametersFromSnapshot(this.router.routerState.snapshot.root);

      if (currentQueryParams) {

        this.appliedFilters.queryParamsWithoutFilter = JSON.parse(JSON.stringify(currentQueryParams));
        delete this.appliedFilters.queryParamsWithoutFilter['filter'];

        this.appliedFilters.pageLevelAppliedFilters = this.utils.processFilterObj(currentQueryParams);

        this.filterArray = this.filterManagementService.getFilterArray(this.appliedFilters.pageLevelAppliedFilters);
      }
    } catch (error) {
      this.errorMessage = 'jsError';
      this.logger.log('error', error);
    }
  }

  updateUrlWithNewFilters(filterArr) {
    this.appliedFilters.pageLevelAppliedFilters = this.utils.arrayToObject(
      this.filterArray,
      'filterkey',
      'value'
    ); // <-- TO update the queryparam which is passed in the filter of the api
    this.appliedFilters.pageLevelAppliedFilters = this.utils.makeFilterObj(this.appliedFilters.pageLevelAppliedFilters);

    /**
     * To change the url
     * with the deleted filter value along with the other existing paramter(ex-->tv:true)
     */

    const updatedFilters = Object.assign(
      this.appliedFilters.pageLevelAppliedFilters,
      this.appliedFilters.queryParamsWithoutFilter
    );

    /*
     Update url with new filters
     */

    this.router.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: updatedFilters
    }).then(success => {
      this.routerParam();
    });
  }

  navigateBack() {
    try {
      this.workflowService.goBackToLastOpenedPageAndUpdateLevel(this.router.routerState.snapshot.root);
    } catch (error) {
      this.logger.log('error', error);
    }

  }

  getData() {

    try {
      if (this.tableSubscription) {
        this.tableSubscription.unsubscribe();
      }
      const payload = {};
      const queryParams = {};
      this.errorValue = 0;
      const accountUrl = environment.getAccounts.url;
      const allVulnerabilityMethod = environment.getAccounts.method;
      this.tableSubscription = this.commonResponseService
        .getData(accountUrl, allVulnerabilityMethod, payload, queryParams)
        .subscribe(
          response => {
            try {
              this.errorValue = 1;
              let data = response;
              if (response.length === 0) {
                this.errorValue = -1;
                this.outerArr = [];
                this.errorMessage = 'noDataAvailable';
                this.allColumns = [];
                this.totalRows = 0;
              }
              if (data.length > 0) {
                this.totalRows = data.length;
                this.firstPaginator =
                  this.bucketNumber * this.paginatorSize + 1;
                this.lastPaginator = data.length;
                this.currentPointer = this.bucketNumber;
                if (this.lastPaginator > this.totalRows) {
                  this.lastPaginator = this.totalRows;
                }
                this.currentBucket[this.bucketNumber] = data;
                data = this.massageData(data);
                this.processData(data);
              }
            } catch (e) {
              this.errorValue = 0;
              this.errorValue = -1;
              this.outerArr = [];
              this.errorMessage = 'jsError';
            }
          },
          error => {
            this.errorValue = -1;
            this.outerArr = [];
            this.errorMessage = 'apiResponseError';
          }
        );
    } catch (error) {

      this.logger.log('error', error);
    }
  }

  massageData(data) {

    const refactoredService = this.refactorFieldsService;
    const newData = [];
    data.map(function (responseData) {
      const KeysTobeChanged = Object.keys(responseData);
      let newObj = {};
      KeysTobeChanged.forEach(element => {
        const elementnew =
          refactoredService.getDisplayNameForAKey(
            element.toLocaleLowerCase()
          ) || element;
        newObj = Object.assign(newObj, { [elementnew]: responseData[element] });
      });
      newData.push(newObj);
    });
    return newData;
  }

  confirmBox() {
    // user selects delete here
    try {
      this.errorValue = 0;
      if (this.tableSubscription) {
        this.tableSubscription.unsubscribe();
      }
      const payload = {};
      console.log('current Id', this.currentId);
      const queryParams = {};
      this.errorValue = 0;
      let accountUrl = environment.deleteAccounts.url;
      accountUrl = accountUrl.replace('{{accountId}}', this.currentId);
      const allVulnerabilityMethod = environment.deleteAccounts.method;
      this.tableSubscription = this.commonResponseService
        .getData(accountUrl, allVulnerabilityMethod, payload, queryParams)
        .subscribe(
          response => {
            try {
              this.showConfBox = false;
              this.updateComponent();
            } catch (e) {

            }
          },
          error => {
            this.errorValue = -1;
            this.errorMessage = 'apiResponseError';
          }
        );
    } catch (error) {

      this.logger.log('error', error);
    }

  }

  handleDropdown(event) {
    console.log(event);
    if (event.type === 'Delete') {
      this.showConfBox = true;

      console.log('event value in handledropdown', event);
      this.currentId = event.data['id'].text;
    } else {
      // redirect to details page
      this.workflowService.addRouterSnapshotToLevel(this.router.routerState.snapshot.root);
      this.router.navigate(['../account-management-details', event.data['id'].text], {
        relativeTo: this.activatedRoute,
        queryParamsHandling: 'merge',
        queryParams: {
        }
      });
    }
  }

  processData(data) {
    try {
      let innerArr = {};
      const totalVariablesObj = {};
      let cellObj = {};

      this.outerArr = [];
      const getData = data;
      let getCols;
      if (getData.length) {
        getCols = Object.keys(getData[0]);
      }
      for (let row = 0; row < getData.length; row++) {
        innerArr = {};
        for (let col = 0; col < getCols.length; col++) {
          cellObj = {
            link: '',
            properties: {
              color: ''
            },
            colName: getCols[col],
            hasPreImg: false,
            imgLink: '',
            text: getData[row][getCols[col]],
            valText: getData[row][getCols[col]]
          };
          innerArr[getCols[col]] = cellObj;
          totalVariablesObj[getCols[col]] = '';
        }
        this.outerArr.push(innerArr);
      }
      if (this.outerArr.length > getData.length) {
        const halfLength = this.outerArr.length / 2;
        this.outerArr = this.outerArr.splice(halfLength);
      }
      this.allColumns = Object.keys(totalVariablesObj);
    } catch (error) {
      this.errorMessage = 'jsError';
      this.logger.log('error', error);
    }
  }

  goToCreate() {
    this.workflowService.addRouterSnapshotToLevel(this.router.routerState.snapshot.root);
    this.router.navigate(['../account-management-create'], {
      relativeTo: this.activatedRoute,
      queryParamsHandling: 'merge',
      queryParams: {
      }
    });
  }

  searchCalled(search) {
    this.searchTxt = search;
    if (this.searchTxt === '') {
      this.searchPassed = this.searchTxt;
    }
  }

  callNewSearch() {
    this.searchPassed = this.searchTxt;
  }
  deleteCondition() {
    if (this.errorValue === 0) {
      // loader
      return 'Your Account is being deleted';
    } else {
      if (this.errorValue === 1) {
        return 'Are you sure you want to delete this account?';
      } else {
        return 'An error occured while deleting your account';
      }
    }
  }

  ngOnDestroy() {
    try {

    } catch (error) {
      this.logger.log('error', 'JS Error - ' + error);
    }
  }

}

