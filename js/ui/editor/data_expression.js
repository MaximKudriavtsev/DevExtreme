const variableWrapper = require('../../core/utils/variable_wrapper');
const dataCoreUtils = require('../../core/utils/data');
const commonUtils = require('../../core/utils/common');
const typeUtils = require('../../core/utils/type');
import DataHelper from '../../data_helper-2';
const DataSourceModule = require('../../data/data_source/data_source');
const ArrayStore = require('../../data/array_store');
const Deferred = require('../../core/utils/deferred').Deferred;

export default class DataExpressionMixin {
    static _compareByCompositeKey(value1, value2, key) {
        const isObject = typeUtils.isObject;

        if(!isObject(value1) || !isObject(value2)) {
            return false;
        }

        for(let i = 0, n = key.length; i < n; i++) {
            if(value1[key[i]] !== value2[key[i]]) {
                return false;
            }
        }

        return true;
    }

    static _getItemKey(value, key) {
        if(Array.isArray(key)) {
            const result = {};
            for(let i = 0, n = key.length; i < n; i++) {
                result[key[i]] = value[key[i]];
            }
            return result;
        }

        if(key && typeof value === 'object') {
            value = value[key];
        }

        return value;
    }

    _dataExpressionDefaultOptions() {
        return {
            items: [],

            dataSource: null,

            itemTemplate: 'item',

            value: null,

            valueExpr: 'this',

            displayExpr: undefined
        };
    }

    _initDataExpressions() {
        this._dataHelper = new DataHelper();

        this._compileValueGetter();
        this._compileDisplayGetter();
        this._initDynamicTemplates();
        // this._initDataSource();
        this._dataHelper._initDataSource();
        this._itemsToDataSource();
    }

    _itemsToDataSource() {
        if(!this.option('dataSource')) {
            // TODO: try this.option("dataSource", new ...)
            this._dataSource = new DataSourceModule.DataSource({
                store: new ArrayStore(this.option('items')),
                pageSize: 0
            });
        }
    }

    _compileDisplayGetter() {
        this._displayGetter = dataCoreUtils.compileGetter(this._displayGetterExpr());
    }

    _displayGetterExpr() {
        return this.option('displayExpr');
    }

    _compileValueGetter() {
        this._valueGetter = dataCoreUtils.compileGetter(this._valueGetterExpr());
    }

    _valueGetterExpr() {
        return this.option('valueExpr') || 'this';
    }

    _loadValue(value) {
        const deferred = new Deferred();
        value = this._unwrappedValue(value);

        if(!typeUtils.isDefined(value)) {
            return deferred.reject().promise();
        }

        this.dataHelper._loadSingle(this._valueGetterExpr(), value)
            .done((function(item) {
                this._isValueEquals(this._valueGetter(item), value)
                    ? deferred.resolve(item)
                    : deferred.reject();
            }).bind(this))
            .fail(() => deferred.reject());

        return deferred.promise();
    }

    _getCurrentValue() {
        return this.option('value');
    }

    _unwrappedValue(value) {
        value = typeUtils.isDefined(value) ? value : this._getCurrentValue();

        if(value && this._dataSource && this._valueGetterExpr() === 'this') {
            const key = this._dataSource.key();
            value = DataExpressionMixin._getItemKey(value, key);
        }

        return variableWrapper.unwrap(value);
    }

    _isValueEquals(value1, value2) {
        const dataSourceKey = this._dataSource && this._dataSource.key();

        const isDefined = typeUtils.isDefined;
        let result = this._compareValues(value1, value2);

        if(!result && dataSourceKey && isDefined(value1) && isDefined(value2)) {
            if(Array.isArray(dataSourceKey)) {
                result = DataExpressionMixin._compareByCompositeKey(value1, value2, dataSourceKey);
            } else {
                result = this._compareByKey(value1, value2, dataSourceKey);
            }
        }

        return result;
    }

    _compareByKey(value1, value2, key) {
        const ensureDefined = commonUtils.ensureDefined;
        const unwrapObservable = variableWrapper.unwrap;
        const valueKey1 = ensureDefined(unwrapObservable(value1[key]), value1);
        const valueKey2 = ensureDefined(unwrapObservable(value2[key]), value2);

        return this._compareValues(valueKey1, valueKey2);
    }

    _compareValues(value1, value2) {
        return dataCoreUtils.toComparable(value1, true) === dataCoreUtils.toComparable(value2, true);
    }

    _initDynamicTemplates() {
        return void 0;
    }

    _setCollectionWidgetItemTemplate() {
        this._initDynamicTemplates();
        this._setCollectionWidgetOption('itemTemplate', this.option('itemTemplate'));
    }

    _getCollectionKeyExpr() {
        const valueExpr = this.option('valueExpr');
        const isValueExprField = typeUtils.isString(valueExpr) && valueExpr !== 'this' || typeUtils.isFunction(valueExpr);

        return isValueExprField ? valueExpr : null;
    }

    _dataExpressionOptionChanged(args) {
        switch(args.name) {
            case 'items':
                this._itemsToDataSource();
                this._setCollectionWidgetOption('items');
                break;
            case 'dataSource':
                this._initDataSource();
                break;
            case 'itemTemplate':
                this._setCollectionWidgetItemTemplate();
                break;
            case 'valueExpr':
                this._compileValueGetter();
                break;
            case 'displayExpr':
                this._compileDisplayGetter();
                this._initDynamicTemplates();
                this._setCollectionWidgetOption('displayExpr');
                break;
        }
    }
}
