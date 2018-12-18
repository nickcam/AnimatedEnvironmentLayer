///////////////////////////////////////////////////////////////////////////
// The MIT License (MIT)
//
// Copyright (c) 2017 Nick Cameron
//
// https://github.com/nickcam/AnimatedEnvironmentLayer
//
// Permission is hereby granted, free of charge, to any person obtaining a 
// copy of this software and associated documentation files (the "Software"), 
// to deal in the Software without restriction, including without limitation 
// the rights to use, copy, modify, merge, publish, distribute, sublicense, 
// and/or sell copies of the Software, and to permit persons to whom the 
// Software is furnished to do so, subject to the following conditions:
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    }
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
define(["require", "exports", "esri/layers/GraphicsLayer", "esri/request", "esri/geometry/support/webMercatorUtils", "esri/core/watchUtils", "esri/geometry/Point", "esri/core/accessorSupport/decorators"], function (require, exports, GraphicsLayer, esriRequest, webMercatorUtils, watchUtils, Point, asd) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var AnimatedEnvironmentLayer = /** @class */ (function (_super) {
        __extends(AnimatedEnvironmentLayer, _super);
        function AnimatedEnvironmentLayer(properties) {
            var _this = _super.call(this, properties) || this;
            _this._viewLoadCount = 0;
            _this._isDrawing = false;
            // If the active view is set in properties, then set it here.
            _this._activeView = properties.activeView;
            _this.url = properties.url;
            _this.displayOptions = properties.displayOptions || {};
            _this.reportValues = properties.reportValues === false ? false : true; // default to true
            _this.on("layerview-create", function (evt) { return _this._layerViewCreated(evt); });
            // watch url prop so a fetch of data and redraw will occur.
            watchUtils.watch(_this, "url", function (a, b, c, d) { return _this._urlChanged(a, b, c, d); });
            // watch url prop so a fetch of data and redraw will occur.
            watchUtils.watch(_this, "visible", function (a, b, c, d) { return _this._visibleChanged(a, b, c, d); });
            // watch display options so to redraw when changed.
            watchUtils.watch(_this, "displayOptions", function (a, b, c, d) { return _this._displayOptionsChanged(a, b, c, d); });
            _this._dataFetchRequired = true;
            return _this;
        }
        /**
         * Start a draw
         */
        AnimatedEnvironmentLayer.prototype.draw = function (forceDataRefetch) {
            var _this = this;
            if (forceDataRefetch != null) {
                this._dataFetchRequired = forceDataRefetch;
            }
            if (!this.url || !this.visible)
                return; // no url set, not visible or is currently drawing, exit here.
            this._isDrawing = true;
            this._setupDraw(this._activeView.width, this._activeView.height);
            // if data should be fetched, go get it now.
            if (this._dataFetchRequired) {
                this.isErrored = false;
                this.dataLoading = true;
                esriRequest(this.url, {
                    responseType: "json"
                })
                    .then(function (response) {
                    _this._dataFetchRequired = false;
                    _this._windy.setData(response.data);
                    _this._doDraw(); // all sorted draw now.
                    _this.dataLoading = false;
                })
                    .otherwise(function (err) {
                    console.error("Error occurred retrieving data. " + err);
                    _this.dataLoading = false;
                    _this.isErrored = true;
                });
            }
            else {
                // no need for data, just draw.
                this._doDraw();
            }
        };
        /**
         * Update the active view. The view must have been assigned to the map previously so that this layer has created or used the canvas element in layerview created already.
         * @param view
         */
        AnimatedEnvironmentLayer.prototype.setView = function (view) {
            this._activeView = view;
            this.draw();
        };
        AnimatedEnvironmentLayer.prototype.stop = function () {
            if (this._windy) {
                this._windy.stop();
            }
        };
        AnimatedEnvironmentLayer.prototype.start = function () {
            this.draw();
        };
        /**
         * Is the active view 2d.
         */
        AnimatedEnvironmentLayer.prototype._is2d = function () {
            return this._activeView ? this._activeView.type === "2d" : false;
        };
        /**
         * Call the windy draw method
         */
        AnimatedEnvironmentLayer.prototype._doDraw = function () {
            var _this = this;
            setTimeout(function () {
                if (_this._is2d()) {
                    _this._windy.start([[0, 0], [_this._canvas2d.width, _this._canvas2d.height]], _this._canvas2d.width, _this._canvas2d.height, [[_this._southWest.x, _this._southWest.y], [_this._northEast.x, _this._northEast.y]]);
                    _this._setDate();
                    _this._isDrawing = false;
                    // if we have a queued draw do it right now.
                    if (_this._queuedDraw) {
                        _this._queuedDraw = false;
                        _this.draw();
                    }
                }
            }, 500);
        };
        /**
         * Init the windy class
         * @param data
         */
        AnimatedEnvironmentLayer.prototype._initWindy = function (data) {
            if (this._is2d()) {
                this._windy = new Windy(this._canvas2d, undefined, this.displayOptions);
            }
        };
        /**
         * Setup the geo bounds of the drawing area
         * @param width
         * @param height
         */
        AnimatedEnvironmentLayer.prototype._setupDraw = function (width, height) {
            // use the extent of the view, and not the extent passed into fetchImage...it was slightly off when it crossed IDL.
            var extent = this._activeView.extent;
            if (extent.spatialReference.isWebMercator) {
                extent = webMercatorUtils.webMercatorToGeographic(extent);
            }
            this._northEast = new Point({ x: extent.xmax, y: extent.ymax });
            this._southWest = new Point({ x: extent.xmin, y: extent.ymin });
            if (this._is2d()) {
                this._canvas2d.width = width;
                this._canvas2d.height = height;
                // cater for the extent crossing the IDL
                if (this._southWest.x > this._northEast.x && this._northEast.x < 0) {
                    this._northEast.x = 360 + this._northEast.x;
                }
            }
        };
        /**
         * Handle layer view created.
         * @param evt
         */
        AnimatedEnvironmentLayer.prototype._layerViewCreated = function (evt) {
            var _this = this;
            // set the active view to the first view loaded if there wasn't one included in the constructor properties.
            this._viewLoadCount++;
            if (this._viewLoadCount === 1 && !this._activeView) {
                this._activeView = evt.layerView.view;
            }
            if (this._is2d()) {
                this._layerView2d = evt.layerView;
                // for map views, wait for the layerview to be attached
                watchUtils.whenTrueOnce(evt.layerView, "attached", function () { return _this._createCanvas(evt.layerView); });
            }
            else {
                this._layerView3d = evt.layerView;
                this._createCanvas(evt.layerView);
            }
            watchUtils.pausable(evt.layerView.view, "stationary", function (isStationary, b, c, view) { return _this._viewStationary(isStationary, b, c, view); });
            if (this.reportValues === true) {
                evt.layerView.view.on("pointer-move", function (evt) { return _this._viewPointerMove(evt); });
            }
        };
        /**
         * Create or assign a canvas element for use in drawing.
         * @param layerView
         */
        AnimatedEnvironmentLayer.prototype._createCanvas = function (layerView) {
            if (this._is2d()) {
                // For a map view get the container element of the layer view and add a canvas to it.
                this._canvas2d = document.createElement("canvas");
                layerView.container.element.appendChild(this._canvas2d);
                // default some styles 
                this._canvas2d.style.position = "absolute";
                this._canvas2d.style.left = "0";
                this._canvas2d.style.top = "0";
            }
            else {
                // Handle scene view canvas in future.            
            }
            // setup windy once the canvas has been created
            this._initWindy();
        };
        /**
         * view stationary handler, clear canvas or force a redraw
         */
        AnimatedEnvironmentLayer.prototype._viewStationary = function (isStationary, b, c, view) {
            if (!this._activeView)
                return;
            if (!isStationary) {
                if (this._windy) {
                    if (this._is2d()) {
                        this._windy.stop(); // force a stop of windy when view is moving
                        this._canvas2d.getContext("2d").clearRect(0, 0, this._activeView.width, this._activeView.height);
                    }
                }
            }
            else {
                if (this._isDrawing) {
                    this._queuedDraw = true;
                }
                else {
                    if (this.displayOptions.particleMultiplierByZoom) {
                        this._setParticleMultiplier();
                    }
                    this.draw();
                }
            }
        };
        AnimatedEnvironmentLayer.prototype._setParticleMultiplier = function () {
            var currentZoom = this._activeView.zoom;
            var baseZoom = this.displayOptions.particleMultiplierByZoom.zoomLevel;
            var pm = this.displayOptions.particleMultiplierByZoom.particleMultiplier;
            if (currentZoom > baseZoom) {
                var zoomDiff = (currentZoom - baseZoom);
                pm = this.displayOptions.particleMultiplierByZoom.particleMultiplier - (zoomDiff * this.displayOptions.particleMultiplierByZoom.diffRatio);
            }
            else if (currentZoom < baseZoom) {
                var zoomDiff = baseZoom - currentZoom;
                pm = this.displayOptions.particleMultiplierByZoom.particleMultiplier + (zoomDiff * this.displayOptions.particleMultiplierByZoom.diffRatio);
            }
            if (pm < this.displayOptions.particleMultiplierByZoom.minMultiplier)
                pm = this.displayOptions.particleMultiplierByZoom.minMultiplier;
            else if (pm > this.displayOptions.particleMultiplierByZoom.maxMultiplier)
                pm = this.displayOptions.particleMultiplierByZoom.maxMultiplier;
            if (this._is2d() && this._windy) {
                this._windy.PARTICLE_MULTIPLIER = pm;
            }
        };
        AnimatedEnvironmentLayer.prototype._viewPointerMove = function (evt) {
            if (!this._windy || !this.visible)
                return;
            var mousePos = this._getMousePos(evt);
            var point = this._activeView.toMap({ x: mousePos.x, y: mousePos.y });
            if (point.spatialReference.isWebMercator) {
                point = webMercatorUtils.webMercatorToGeographic(point);
            }
            var grid = this._windy.interpolate(point.x, point.y);
            var result = {
                point: point,
                target: this
            };
            if (!grid || (isNaN(grid[0]) || isNaN(grid[1]) || !grid[2])) {
                // the current point contains no data in the windy grid, so emit an object with no speed or direction object
                this.emit("point-report", result);
                return;
            }
            // get the speed and direction and emit the result
            result.velocity = this._vectorToSpeed(grid[0], grid[1]);
            result.degree = this._vectorToDegrees(grid[0], grid[1]);
            this.emit("point-report", result);
        };
        /**
         * Convert the windy vector data to meters per second
         * @param uMs
         * @param vMs
         */
        AnimatedEnvironmentLayer.prototype._vectorToSpeed = function (uMs, vMs) {
            var speedAbs = Math.sqrt(Math.pow(uMs, 2) + Math.pow(vMs, 2));
            return speedAbs;
        };
        /**
         * Return the windy vector data as a direction. Returns the direction of the flow of the data with the degrees in a clockwise direction.
         * @param uMs
         * @param vMs
         */
        AnimatedEnvironmentLayer.prototype._vectorToDegrees = function (uMs, vMs) {
            var abs = Math.sqrt(Math.pow(uMs, 2) + Math.pow(vMs, 2));
            var direction = Math.atan2(uMs / abs, vMs / abs);
            var directionToDegrees = direction * 180 / Math.PI + 180;
            directionToDegrees += 180;
            if (directionToDegrees >= 360)
                directionToDegrees -= 360;
            return directionToDegrees;
        };
        AnimatedEnvironmentLayer.prototype._getMousePos = function (evt) {
            // container on the view is actually a html element at this point, not a string as the typings suggest.
            var container = this._activeView.container;
            var rect = container.getBoundingClientRect();
            return {
                x: evt.x - rect.left,
                y: evt.y - rect.top
            };
        };
        /**
         * Watch of the url property - call draw again with a refetch
         */
        AnimatedEnvironmentLayer.prototype._urlChanged = function (a, b, c, d) {
            if (this._windy)
                this._windy.stop();
            this._dataFetchRequired = true;
            this.draw();
        };
        /**
         * Watch of the url property - call draw again with a refetch
         */
        AnimatedEnvironmentLayer.prototype._visibleChanged = function (visible, b, c, d) {
            if (!visible) {
                if (this._windy)
                    this._windy.stop();
            }
            else {
                this.draw();
            }
        };
        /**
         * Watch of displayOptions - call draw again with new options set on windy.
         */
        AnimatedEnvironmentLayer.prototype._displayOptionsChanged = function (newOptions, b, c, d) {
            if (!this._windy)
                return;
            this._windy.stop();
            this._windy.setDisplayOptions(newOptions);
            this.draw();
        };
        AnimatedEnvironmentLayer.prototype._setDate = function () {
            if (this._is2d() && this._windy) {
                if (this._windy.refTime && this._windy.forecastTime) {
                    // assume the ref time is an iso string, or some other equivalent that javascript Date object can parse.
                    var d = new Date(this._windy.refTime);
                    // add the forecast time as hours to the refTime;
                    d.setHours(d.getHours() + this._windy.forecastTime);
                    this.date = d;
                    return;
                }
            }
            this.date = undefined;
        };
        __decorate([
            asd.property(),
            __metadata("design:type", String)
        ], AnimatedEnvironmentLayer.prototype, "url", void 0);
        __decorate([
            asd.property(),
            __metadata("design:type", Object)
        ], AnimatedEnvironmentLayer.prototype, "displayOptions", void 0);
        __decorate([
            asd.property(),
            __metadata("design:type", Boolean)
        ], AnimatedEnvironmentLayer.prototype, "reportValues", void 0);
        __decorate([
            asd.property(),
            __metadata("design:type", Boolean)
        ], AnimatedEnvironmentLayer.prototype, "dataLoading", void 0);
        __decorate([
            asd.property(),
            __metadata("design:type", Boolean)
        ], AnimatedEnvironmentLayer.prototype, "isErrored", void 0);
        AnimatedEnvironmentLayer = __decorate([
            asd.subclass("AnimatedEnvironmentLayer"),
            __metadata("design:paramtypes", [Object])
        ], AnimatedEnvironmentLayer);
        return AnimatedEnvironmentLayer;
    }(asd.declared(GraphicsLayer)));
    exports.AnimatedEnvironmentLayer = AnimatedEnvironmentLayer;
    /*  Global class for simulating the movement of particle through grid
     credit: All the credit for this work goes to: https://github.com/cambecc for creating the repo:
     https://github.com/cambecc/earth. The majority of this code is directly taken from there, since its awesome.
     This class takes a canvas element and an array of data (1km GFS from http://www.emc.ncep.noaa.gov/index.php?branch=GFS)
     and then uses a mercator (forward/reverse) projection to correctly map wind vectors in "map space".
     The "start" method takes the bounds of the map at its current extent and starts the whole gridding,
     interpolation and animation process.
     Extra credit to https://github.com/danwild/leaflet-velocity for modifying the class to be more customizable and reusable for other scenarios.
     Also credit to - https://github.com/Esri/wind-js
     */
    var Windy = /** @class */ (function () {
        function Windy(canvas, data, options) {
            this.NULL_WIND_VECTOR = [NaN, NaN, null]; // singleton for no wind in the form: [u, v, magnitude]
            this.canvas = canvas;
            if (!options)
                options = {};
            this.setDisplayOptions(options);
            this.gridData = data;
        }
        Windy.prototype.setData = function (data) {
            this.gridData = data;
        };
        Windy.prototype.setDisplayOptions = function (options) {
            this.MIN_VELOCITY_INTENSITY = options.minVelocity || 0; // velocity at which particle intensity is minimum (m/s)
            this.MAX_VELOCITY_INTENSITY = options.maxVelocity || 10; // velocity at which particle intensity is maximum (m/s)
            this.VELOCITY_SCALE = (options.velocityScale || 0.005) * (Math.pow(window.devicePixelRatio, 1 / 3) || 1); // scale for wind velocity (completely arbitrary--this value looks nice)
            this.MAX_PARTICLE_AGE = options.particleAge || 90; // max number of frames a particle is drawn before regeneration
            this.PARTICLE_LINE_WIDTH = options.lineWidth || 1; // line width of a drawn particle
            // default particle multiplier to 2
            this.PARTICLE_MULTIPLIER = options.particleMultiplier || 2;
            this.PARTICLE_REDUCTION = Math.pow(window.devicePixelRatio, 1 / 3) || 1.6; // multiply particle count for mobiles by this amount
            this.FRAME_RATE = options.frameRate || 15;
            this.FRAME_TIME = 1000 / this.FRAME_RATE; // desired frames per second
            var defaultColorScale = ["rgb(61,160,247)", "rgb(99,164,217)", "rgb(138,168,188)", "rgb(177,173,158)", "rgb(216,177,129)", "rgb(255,182,100)", "rgb(240,145,87)", "rgb(225,109,74)", "rgb(210,72,61)", "rgb(195,36,48)", "rgb(180,0,35)"];
            this.colorScale = options.colorScale || defaultColorScale;
        };
        Windy.prototype.start = function (bounds, width, height, extent) {
            var _this = this;
            var mapBounds = {
                south: this.deg2rad(extent[0][1]),
                north: this.deg2rad(extent[1][1]),
                east: this.deg2rad(extent[1][0]),
                west: this.deg2rad(extent[0][0]),
                width: width,
                height: height
            };
            this.stop();
            // build grid
            this.buildGrid(this.gridData, function (gridResult) {
                var builtBounds = _this.buildBounds(bounds, width, height);
                _this.interpolateField(gridResult, builtBounds, mapBounds, function (bounds, field) {
                    // animate the canvas with random points
                    Windy.field = field;
                    _this.animate(bounds, Windy.field);
                });
            });
        };
        Windy.prototype.stop = function () {
            if (Windy.field)
                Windy.field.release();
            if (Windy.animationLoop)
                cancelAnimationFrame(Windy.animationLoop);
        };
        /**
        * Get interpolated grid value from Lon/Lat position
       * @param λ {Float} Longitude
       * @param φ {Float} Latitude
       * @returns {Object}
       */
        Windy.prototype.interpolate = function (λ, φ) {
            if (!this.grid)
                return null;
            var i = this.floorMod(λ - this.λ0, 360) / this.Δλ; // calculate longitude index in wrapped range [0, 360)
            var j = (this.φ0 - φ) / this.Δφ; // calculate latitude index in direction +90 to -90
            if (this._scanMode === 64) {
                // calculate latitude index in direction -90 to +90 as this is scan mode 64
                j = (φ - this.φ0) / this.Δφ;
                j = this.grid.length - j;
            }
            var fi = Math.floor(i), ci = fi + 1;
            var fj = Math.floor(j), cj = fj + 1;
            var row;
            if (row = this.grid[fj]) {
                var g00 = row[fi];
                var g10 = row[ci];
                if (this.isValue(g00) && this.isValue(g10) && (row = this.grid[cj])) {
                    var g01 = row[fi];
                    var g11 = row[ci];
                    if (this.isValue(g01) && this.isValue(g11)) {
                        // All four points found, so interpolate the value.
                        return this.builder.interpolate(i - fi, j - fj, g00, g10, g01, g11);
                    }
                }
            }
            return null;
        };
        Windy.prototype.buildGrid = function (data, callback) {
            this.builder = this.createBuilder(data);
            var header = this.builder.header;
            this.λ0 = header.lo1;
            this.φ0 = header.la1; // the grid's origin (e.g., 0.0E, 90.0N)
            this.Δλ = header.dx;
            this.Δφ = header.dy; // distance between grid points (e.g., 2.5 deg lon, 2.5 deg lat)
            this.ni = header.nx;
            this.nj = header.ny; // number of grid points W-E and N-S (e.g., 144 x 73)
            this.date = new Date(header.refTime);
            this.date.setHours(this.date.getHours() + header.forecastTime);
            this._scanMode = header.scanMode;
            this.grid = [];
            var p = 0;
            var isContinuous = Math.floor(this.ni * this.Δλ) >= 360;
            if (header.scanMode === 0) {
                // Scan mode 0. Longitude increases from λ0, and latitude decreases from φ0.
                // http://www.nco.ncep.noaa.gov/pmb/docs/grib2/grib2_table3-4.shtml
                for (var j = 0; j < this.nj; j++) {
                    var row = [];
                    for (var i = 0; i < this.ni; i++, p++) {
                        row[i] = this.builder.data(p);
                    }
                    if (isContinuous) {
                        // For wrapped grids, duplicate first column as last column to simplify interpolation logic
                        row.push(row[0]);
                    }
                    this.grid[j] = row;
                }
            }
            else if (header.scanMode === 64) {
                // Scan mode 64. Longitude increases from λ0, and latitude increases from φ0.
                for (var j = this.nj - 1; j >= 0; j--) {
                    var row = [];
                    for (var i = 0; i < this.ni; i++, p++) {
                        row[i] = this.builder.data(p);
                    }
                    if (isContinuous) {
                        // For wrapped grids, duplicate first column as last column to simplify interpolation logic
                        row.push(row[0]);
                    }
                    this.grid[j] = row;
                }
            }
            callback({
                date: this.date,
                interpolate: this.interpolate
            });
        };
        Windy.prototype.createBuilder = function (data) {
            var _this = this;
            var uComp = null, vComp = null, scalar = null, directionTrue = null, magnitude = null;
            var supported = true;
            var headerFields;
            data.forEach(function (record) {
                headerFields = record.header.discipline + "," + record.header.parameterCategory + "," + record.header.parameterNumber;
                switch (headerFields) {
                    case "0,1,2":
                    case "0,2,2":
                        uComp = record; // this is meteorological component with u and v.
                        break;
                    case "0,1,3":
                    case "0,2,3":
                        vComp = record; // this is meteorological component with u and v.
                        break;
                    case "10,0,7":
                    case "10,0,10":
                    case "0,2,0":
                        directionTrue = record; //waves and wind direction
                        break;
                    case "10,0,8":
                    case "10,0,3":
                    case "0,2,1":
                        magnitude = record; //waves and wind height
                        break;
                    default:
                        supported = false;
                        return;
                }
                // just take the last records reftime and forecast time as the one we're using
                _this.refTime = record.header.refTime;
                _this.forecastTime = record.header.forecastTime;
            });
            if (!supported) {
                console.error("Windy doesn't support discipline, category and number combination. " + headerFields);
                return undefined;
            }
            if (directionTrue && magnitude) {
                // If data contains a direction and magnitude convert it to a u and v.
                uComp = {};
                uComp.header = directionTrue.header;
                vComp = {};
                vComp.header = directionTrue.header;
                uComp.data = [];
                vComp.data = [];
                for (var i = 0, len = directionTrue.data.length; i < len; i++) {
                    var dir = directionTrue.data[i];
                    var mag = magnitude.data[i];
                    if ((!dir || isNaN(dir)) || (!mag || isNaN(mag))) {
                        vComp[i] = null;
                        uComp[i] = null;
                        continue;
                    }
                    var phi = dir * Math.PI / 180;
                    var u = -mag * Math.sin(phi);
                    var v = -mag * Math.cos(phi);
                    uComp.data[i] = u;
                    vComp.data[i] = v;
                }
            }
            return this.createWindBuilder(uComp, vComp);
        };
        Windy.prototype.createWindBuilder = function (uComp, vComp) {
            var uData = uComp.data, vData = vComp.data;
            return {
                header: uComp.header,
                data: function data(i) {
                    return [uData[i], vData[i]];
                },
                interpolate: this.bilinearInterpolateVector
            };
        };
        Windy.prototype.buildBounds = function (bounds, width, height) {
            var upperLeft = bounds[0];
            var lowerRight = bounds[1];
            var x = Math.round(upperLeft[0]);
            var y = Math.max(Math.floor(upperLeft[1]), 0);
            var xMax = Math.min(Math.ceil(lowerRight[0]), width - 1);
            var yMax = Math.min(Math.ceil(lowerRight[1]), height - 1);
            return { x: x, y: y, xMax: width, yMax: yMax, width: width, height: height };
        };
        // interpolation for vectors like wind (u,v,m)
        Windy.prototype.bilinearInterpolateVector = function (x, y, g00, g10, g01, g11) {
            var rx = 1 - x;
            var ry = 1 - y;
            var a = rx * ry, b = x * ry, c = rx * y, d = x * y;
            var u = g00[0] * a + g10[0] * b + g01[0] * c + g11[0] * d;
            var v = g00[1] * a + g10[1] * b + g01[1] * c + g11[1] * d;
            return [u, v, Math.sqrt(u * u + v * v)];
        };
        Windy.prototype.deg2rad = function (deg) {
            return deg / 180 * Math.PI;
        };
        Windy.prototype.rad2deg = function (ang) {
            return ang / (Math.PI / 180.0);
        };
        /**
        * @returns {Boolean} true if the specified value is not null and not undefined.
        */
        Windy.prototype.isValue = function (x) {
            return x !== null && x !== undefined;
        };
        /**
        * @returns {Number} returns remainder of floored division, i.e., floor(a / n). Useful for consistent modulo
        *          of negative numbers. See http://en.wikipedia.org/wiki/Modulo_operation.
        */
        Windy.prototype.floorMod = function (a, n) {
            return a - n * Math.floor(a / n);
        };
        /**
        * @returns {Number} the value x clamped to the range [low, high].
        */
        Windy.prototype.clamp = function (x, range) {
            return Math.max(range[0], Math.min(x, range[1]));
        };
        /**
        * @returns {Boolean} true if agent is probably a mobile device. Don't really care if this is accurate.
        */
        Windy.prototype.isMobile = function () {
            return (/android|blackberry|iemobile|ipad|iphone|ipod|opera mini|webos/i.test(navigator.userAgent));
        };
        /**
        * Calculate distortion of the wind vector caused by the shape of the projection at point (x, y). The wind
        * vector is modified in place and returned by this function.
        */
        Windy.prototype.distort = function (projection, λ, φ, x, y, scale, wind, windy) {
            var u = wind[0] * scale;
            var v = wind[1] * scale;
            var d = this.distortion(projection, λ, φ, x, y, windy);
            // Scale distortion vectors by u and v, then add.
            wind[0] = d[0] * u + d[2] * v;
            wind[1] = d[1] * u + d[3] * v;
            return wind;
        };
        Windy.prototype.distortion = function (projection, λ, φ, x, y, windy) {
            var τ = 2 * Math.PI;
            var H = Math.pow(10, -5.2);
            var hλ = λ < 0 ? H : -H;
            var hφ = φ < 0 ? H : -H;
            var pλ = this.project(φ, λ + hλ, windy);
            var pφ = this.project(φ + hφ, λ, windy);
            // Meridian scale factor (see Snyder, equation 4-3), where R = 1. This handles issue where length of 1º λ
            // changes depending on φ. Without this, there is a pinching effect at the poles.
            var k = Math.cos(φ / 360 * τ);
            return [(pλ[0] - x) / hλ / k, (pλ[1] - y) / hλ / k, (pφ[0] - x) / hφ, (pφ[1] - y) / hφ];
        };
        Windy.prototype.mercY = function (lat) {
            return Math.log(Math.tan(lat / 2 + Math.PI / 4));
        };
        Windy.prototype.project = function (lat, lon, windy) {
            // both in radians, use deg2rad if neccessary
            var ymin = this.mercY(windy.south);
            var ymax = this.mercY(windy.north);
            var xFactor = windy.width / (windy.east - windy.west);
            var yFactor = windy.height / (ymax - ymin);
            var y = this.mercY(this.deg2rad(lat));
            var x = (this.deg2rad(lon) - windy.west) * xFactor;
            y = (ymax - y) * yFactor; // y points south
            return [x, y];
        };
        Windy.prototype.invert = function (x, y, windy) {
            var mapLonDelta = windy.east - windy.west;
            var worldMapRadius = windy.width / this.rad2deg(mapLonDelta) * 360 / (2 * Math.PI);
            var mapOffsetY = worldMapRadius / 2 * Math.log((1 + Math.sin(windy.south)) / (1 - Math.sin(windy.south)));
            var equatorY = windy.height + mapOffsetY;
            var a = (equatorY - y) / worldMapRadius;
            var lat = 180 / Math.PI * (2 * Math.atan(Math.exp(a)) - Math.PI / 2);
            var lon = this.rad2deg(windy.west) + x / windy.width * this.rad2deg(mapLonDelta);
            return [lon, lat];
        };
        Windy.prototype.interpolateField = function (grid, bounds, extent, callback) {
            var _this = this;
            var projection = {};
            var mapArea = (extent.south - extent.north) * (extent.west - extent.east);
            var velocityScale = this.VELOCITY_SCALE * Math.pow(mapArea, 0.4);
            var columns = [];
            var x = bounds.x;
            var interpolateColumn = function (x) {
                var column = [];
                for (var y = bounds.y; y <= bounds.yMax; y += 2) {
                    var coord = _this.invert(x, y, extent);
                    if (coord) {
                        var λ = coord[0], φ = coord[1];
                        if (isFinite(λ)) {
                            //let wind = grid.interpolate(λ, φ);
                            var wind = _this.interpolate(λ, φ);
                            if (wind) {
                                wind = _this.distort(projection, λ, φ, x, y, velocityScale, wind, extent);
                                column[y + 1] = column[y] = wind;
                            }
                        }
                    }
                }
                columns[x + 1] = columns[x] = column;
            };
            var batchInterpolate = function () {
                var start = Date.now();
                while (x < bounds.width) {
                    interpolateColumn(x);
                    x += 2;
                    if (Date.now() - start > 1000) {
                        //MAX_TASK_TIME) {
                        setTimeout(function () { return batchInterpolate; }, 25);
                        return;
                    }
                }
                _this.createField(columns, bounds, callback);
            };
            batchInterpolate();
        };
        Windy.prototype.createField = function (columns, bounds, callback) {
            var _this = this;
            /**
            * @returns {Array} wind vector [u, v, magnitude] at the point (x, y), or [NaN, NaN, null] if wind
            *          is undefined at that point.
            */
            var field = function (x, y) {
                var column = columns[Math.round(x)];
                return column && column[Math.round(y)] || _this.NULL_WIND_VECTOR;
            };
            // Frees the massive "columns" array for GC. Without this, the array is leaked (in Chrome) each time a new
            // field is interpolated because the field closure's context is leaked, for reasons that defy explanation.
            field.release = function () {
                columns = [];
            };
            field.randomize = function (o) {
                // UNDONE: this method is terrible
                var x, y;
                var safetyNet = 0;
                do {
                    x = Math.round(Math.floor(Math.random() * bounds.width) + bounds.x);
                    y = Math.round(Math.floor(Math.random() * bounds.height) + bounds.y);
                } while (field(x, y)[2] === null && safetyNet++ < 30);
                o.x = x;
                o.y = y;
                return o;
            };
            callback(bounds, field);
        };
        Windy.prototype.animate = function (bounds, field) {
            var _this = this;
            var windIntensityColorScale = function (min, max) {
                _this.colorScale.indexFor = function (m) {
                    // map velocity speed to a style
                    return Math.max(0, Math.min(_this.colorScale.length - 1, Math.round((m - min) / (max - min) * (_this.colorScale.length - 1))));
                };
                return _this.colorScale;
            };
            var colorStyles = windIntensityColorScale(this.MIN_VELOCITY_INTENSITY, this.MAX_VELOCITY_INTENSITY);
            var buckets = colorStyles.map(function () {
                return [];
            });
            var particleCount = Math.round(bounds.width * bounds.height * this.PARTICLE_MULTIPLIER / 1000);
            if (this.isMobile()) {
                particleCount *= this.PARTICLE_REDUCTION;
            }
            var fadeFillStyle = "rgba(0, 0, 0, 0.97)";
            var particles = [];
            for (var i = 0; i < particleCount; i++) {
                particles.push(field.randomize({ age: Math.floor(Math.random() * this.MAX_PARTICLE_AGE) + 0 }));
            }
            var evolve = function () {
                buckets.forEach(function (bucket) {
                    bucket.length = 0;
                });
                particles.forEach(function (particle) {
                    if (particle.age > _this.MAX_PARTICLE_AGE) {
                        field.randomize(particle).age = 0;
                    }
                    var x = particle.x;
                    var y = particle.y;
                    var v = field(x, y); // vector at current position
                    var m = v[2];
                    if (m === null) {
                        particle.age = _this.MAX_PARTICLE_AGE; // particle has escaped the grid, never to return...
                    }
                    else {
                        var xt = x + v[0];
                        var yt = y + v[1];
                        if (field(xt, yt)[2] !== null) {
                            // Path from (x,y) to (xt,yt) is visible, so add this particle to the appropriate draw bucket.
                            particle.xt = xt;
                            particle.yt = yt;
                            buckets[colorStyles.indexFor(m)].push(particle);
                        }
                        else {
                            // Particle isn't visible, but it still moves through the field.
                            particle.x = xt;
                            particle.y = yt;
                        }
                    }
                    particle.age += 1;
                });
            };
            var g = this.canvas.getContext("2d");
            g.lineWidth = this.PARTICLE_LINE_WIDTH;
            g.fillStyle = fadeFillStyle;
            g.globalAlpha = 0.6;
            var draw = function () {
                // Fade existing particle trails.
                var prev = "lighter";
                g.globalCompositeOperation = "destination-in";
                g.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
                g.globalCompositeOperation = prev;
                g.globalAlpha = 0.9;
                // Draw new particle trails.
                buckets.forEach(function (bucket, i) {
                    if (bucket.length > 0) {
                        g.beginPath();
                        g.strokeStyle = colorStyles[i];
                        bucket.forEach(function (particle) {
                            g.moveTo(particle.x, particle.y);
                            g.lineTo(particle.xt, particle.yt);
                            particle.x = particle.xt;
                            particle.y = particle.yt;
                        });
                        g.stroke();
                    }
                });
            };
            var then = Date.now();
            var frame = function () {
                Windy.animationLoop = requestAnimationFrame(frame);
                var now = Date.now();
                var delta = now - then;
                if (delta > _this.FRAME_TIME) {
                    then = now - delta % _this.FRAME_TIME;
                    evolve();
                    draw();
                }
            };
            frame();
        };
        return Windy;
    }());
    if (!window.cancelAnimationFrame) {
        window.cancelAnimationFrame = function (id) {
            clearTimeout(id);
        };
    }
});
//# sourceMappingURL=animatedEnvironmentLayer.js.map