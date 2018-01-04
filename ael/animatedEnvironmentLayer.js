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
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
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
    var AnimatedEnvironmentLayer = (function (_super) {
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
    var Windy = (function () {
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3R5cGVzY3JpcHQvYW5pbWF0ZWRFbnZpcm9ubWVudExheWVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDJFQUEyRTtBQUMzRSx3QkFBd0I7QUFDeEIsRUFBRTtBQUNGLGtDQUFrQztBQUNsQyxFQUFFO0FBQ0Ysc0RBQXNEO0FBQ3RELEVBQUU7QUFDRiwyRUFBMkU7QUFDM0UsOEVBQThFO0FBQzlFLDZFQUE2RTtBQUM3RSw0RUFBNEU7QUFDNUUseUVBQXlFO0FBQ3pFLHVFQUF1RTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7SUFvRnZFO1FBQThDLDRDQUEyQjtRQXNDckUsa0NBQVksVUFBOEM7WUFBMUQsWUFDSSxrQkFBTSxVQUFVLENBQUMsU0FtQnBCO1lBNUJPLG9CQUFjLEdBQVcsQ0FBQyxDQUFDO1lBRTNCLGdCQUFVLEdBQVksS0FBSyxDQUFDO1lBU2hDLDZEQUE2RDtZQUM3RCxLQUFJLENBQUMsV0FBVyxHQUFHLFVBQVUsQ0FBQyxVQUFVLENBQUM7WUFDekMsS0FBSSxDQUFDLEdBQUcsR0FBRyxVQUFVLENBQUMsR0FBRyxDQUFDO1lBQzFCLEtBQUksQ0FBQyxjQUFjLEdBQUcsVUFBVSxDQUFDLGNBQWMsSUFBSSxFQUFFLENBQUM7WUFDdEQsS0FBSSxDQUFDLFlBQVksR0FBRyxVQUFVLENBQUMsWUFBWSxLQUFLLEtBQUssR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDLENBQUMsa0JBQWtCO1lBRXhGLEtBQUksQ0FBQyxFQUFFLENBQUMsa0JBQWtCLEVBQUUsVUFBQyxHQUFHLElBQUssT0FBQSxLQUFJLENBQUMsaUJBQWlCLENBQUMsR0FBRyxDQUFDLEVBQTNCLENBQTJCLENBQUMsQ0FBQztZQUVsRSwyREFBMkQ7WUFDM0QsVUFBVSxDQUFDLEtBQUssQ0FBQyxLQUFJLEVBQUUsS0FBSyxFQUFFLFVBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxJQUFLLE9BQUEsS0FBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLEVBQUUs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QUFHLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDZixJQUFJLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUNYLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxFQUNWLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxFQUNWLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ2QsSUFBSSxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUMxRCxJQUFJLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQzFELE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzVDLENBQUM7UUFFTyx1QkFBTyxHQUFmLFVBQWdCLEdBQUc7WUFDZixNQUFNLENBQUMsR0FBRyxHQUFHLEdBQUcsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDO1FBQy9CLENBQUM7UUFFTyx1QkFBTyxHQUFmLFVBQWdCLEdBQUc7WUFDZixNQUFNLENBQUMsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsR0FBRyxLQUFLLENBQUMsQ0FBQztRQUNuQyxDQUFDO1FBRUQ7O1VBRUU7UUFDTSx1QkFBTyxHQUFmLFVBQWdCLENBQUM7WUFDYixNQUFNLENBQUMsQ0FBQyxLQUFLLElBQUksSUFBSSxDQUFDLEtBQUssU0FBUyxDQUFDO1FBQ3pDLENBQUM7UUFFRDs7O1VBR0U7UUFDTSx3QkFBUSxHQUFoQixVQUFpQixDQUFDLEVBQUUsQ0FBQztZQUNqQixNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUNyQyxDQUFDO1FBRUQ7O1VBRUU7UUFDTSxxQkFBSyxHQUFiLFVBQWMsQ0FBQyxFQUFFLEtBQUs7WUFDbEIsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDckQsQ0FBQztRQUVEOztVQUVFO1FBQ00sd0JBQVEsR0FBaEI7WUFDSSxNQUFNLENBQUMsQ0FBQyxnRUFBZ0UsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7UUFDeEcsQ0FBQztRQUVEOzs7VUFHRTtRQUNNLHVCQUFPLEdBQWYsVUFBZ0IsVUFBVSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEtBQUs7WUFDdEQsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQztZQUN4QixJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDO1lBQ3hCLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsVUFBVSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUV2RCxpREFBaUQ7WUFDakQsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUM5QixJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQzlCLE1BQU0sQ0FBQyxJQUFJLENBQUM7UUFDaEIsQ0FBQztRQUVPLDBCQUFVLEdBQWxCLFVBQW1CLFVBQVUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsS0FBSztZQUM1QyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FBQztZQUNwQixJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQzNCLElBQUksRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1lBQ3hCLElBQUksRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1lBRXhCLElBQUksRUFBRSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDeEMsSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUV4Qyx5R0FBeUc7WUFDekcsaUZBQWlGO1lBQ2pGLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQztZQUM5QixNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO1FBQzVGLENBQUM7UUFFTyxxQkFBSyxHQUFiLFVBQWMsR0FBRztZQUNiLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDckQsQ0FBQztRQUVPLHVCQUFPLEdBQWYsVUFBZ0IsR0FBRyxFQUFFLEdBQUcsRUFBRSxLQUFLO1lBQzNCLDZDQUE2QztZQUM3QyxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUNuQyxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUNuQyxJQUFJLE9BQU8sR0FBRyxLQUFLLENBQUMsS0FBSyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDdEQsSUFBSSxPQUFPLEdBQUcsS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsQ0FBQztZQUUzQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztZQUN0QyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLE9BQU8sQ0FBQztZQUNuRCxDQUFDLEdBQUcsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLENBQUMsaUJBQWlCO1lBQzNDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUNsQixDQUFDO1FBRU8sc0JBQU0sR0FBZCxVQUFlLENBQUMsRUFBRSxDQUFDLEVBQUUsS0FBSztZQUN0QixJQUFJLFdBQVcsR0FBRyxLQUFLLENBQUMsSUFBSSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUM7WUFDMUMsSUFBSSxjQUFjLEdBQUcsS0FBSyxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDbkYsSUFBSSxVQUFVLEdBQUcsY0FBYyxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzFHLElBQUksUUFBUSxHQUFHLEtBQUssQ0FBQyxNQUFNLEdBQUcsVUFBVSxDQUFDO1lBQ3pDLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxHQUFHLENBQUMsQ0FBQyxHQUFHLGNBQWMsQ0FBQztZQUV4QyxJQUFJLEdBQUcsR0FBRyxHQUFHLEdBQUcsSUFBSSxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO1lBQ3JFLElBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxLQUFLLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDakYsTUFBTSxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ3RCLENBQUM7UUFHTyxnQ0FBZ0IsR0FBeEIsVUFBeUIsSUFBSSxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsUUFBUTtZQUF2RCxpQkEyQ0M7WUF6Q0csSUFBSSxVQUFVLEdBQUcsRUFBRSxDQUFDO1lBQ3BCLElBQUksT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUssR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUMxRSxJQUFJLGFBQWEsR0FBRyxJQUFJLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1lBRWpFLElBQUksT0FBTyxHQUFHLEVBQUUsQ0FBQztZQUNqQixJQUFJLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDO1lBRWpCLElBQUksaUJBQWlCLEdBQUcsVUFBQyxDQUFDO2dCQUN0QixJQUFJLE1BQU0sR0FBRyxFQUFFLENBQUM7Z0JBQ2hCLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO29CQUM5QyxJQUFJLEtBQUssR0FBRyxLQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUM7b0JBQ3RDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7d0JBQ1IsSUFBSSxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUNaLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7d0JBQ2pCLEVBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7NEJBQ2Qsb0NBQW9DOzRCQUNwQyxJQUFJLElBQUksR0FBRyxLQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQzs0QkFDbEMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztnQ0FDUCxJQUFJLEdBQUcsS0FBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLGFBQWEsRUFBRSxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7Z0NBQ3pFLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQzs0QkFDckMsQ0FBQzt3QkFDTCxDQUFDO29CQUNMLENBQUM7Z0JBQ0wsQ0FBQztnQkFDRCxPQUFPLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUM7WUFDekMsQ0FBQyxDQUFDO1lBRUYsSUFBSSxnQkFBZ0IsR0FBRztnQkFDbkIsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO2dCQUN2QixPQUFPLENBQUMsR0FBRyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUM7b0JBQ3RCLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUNyQixDQUFDLElBQUksQ0FBQyxDQUFDO29CQUNQLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQzt3QkFDNUIsa0JBQWtCO3dCQUNsQixVQUFVLENBQUMsY0FBTSxPQUFBLGdCQUFnQixFQUFoQixDQUFnQixFQUFFLEVBQUUsQ0FBQyxDQUFDO3dCQUN2QyxNQUFNLENBQUM7b0JBQ1gsQ0FBQztnQkFDTCxDQUFDO2dCQUNELEtBQUksQ0FBQyxXQUFXLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxRQUFRLENBQUMsQ0FBQztZQUNoRCxDQUFDLENBQUM7WUFDRixnQkFBZ0IsRUFBRSxDQUFDO1FBQ3ZCLENBQUM7UUFHTywyQkFBVyxHQUFuQixVQUFvQixPQUFPLEVBQUUsTUFBTSxFQUFFLFFBQVE7WUFBN0MsaUJBK0JDO1lBN0JHOzs7Y0FHRTtZQUNGLElBQUksS0FBSyxHQUFRLFVBQUMsQ0FBQyxFQUFFLENBQUM7Z0JBQ2xCLElBQUksTUFBTSxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3BDLE1BQU0sQ0FBQyxNQUFNLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFJLENBQUMsZ0JBQWdCLENBQUM7WUFDcEUsQ0FBQyxDQUFBO1lBRUQsMEdBQTBHO1lBQzFHLDBHQUEwRztZQUMxRyxLQUFLLENBQUMsT0FBTyxHQUFHO2dCQUNaLE9BQU8sR0FBRyxFQUFFLENBQUM7WUFDakIsQ0FBQyxDQUFDO1lBRUYsS0FBSyxDQUFDLFNBQVMsR0FBRyxVQUFDLENBQUM7Z0JBQ2hCLGtDQUFrQztnQkFDbEMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO2dCQUNULElBQUksU0FBUyxHQUFHLENBQUMsQ0FBQztnQkFDbEIsR0FBRyxDQUFDO29CQUNBLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQ3BFLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3pFLENBQUMsUUFBUSxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLElBQUksSUFBSSxTQUFTLEVBQUUsR0FBRyxFQUFFLEVBQUU7Z0JBQ3RELENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUNSLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUNSLE1BQU0sQ0FBQyxDQUFDLENBQUM7WUFDYixDQUFDLENBQUM7WUFFRixRQUFRLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQzVCLENBQUM7UUFFTyx1QkFBTyxHQUFmLFVBQWdCLE1BQU0sRUFBRSxLQUFLO1lBQTdCLGlCQW9HQztZQWxHRyxJQUFJLHVCQUF1QixHQUFHLFVBQUMsR0FBRyxFQUFFLEdBQUc7Z0JBQ25DLEtBQUksQ0FBQyxVQUFVLENBQUMsUUFBUSxHQUFHLFVBQUMsQ0FBQztvQkFDekIsZ0NBQWdDO29CQUNoQyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNqSSxDQUFDLENBQUM7Z0JBQ0YsTUFBTSxDQUFDLEtBQUksQ0FBQyxVQUFVLENBQUM7WUFDM0IsQ0FBQyxDQUFBO1lBRUQsSUFBSSxXQUFXLEdBQUcsdUJBQXVCLENBQUMsSUFBSSxDQUFDLHNCQUFzQixFQUFFLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO1lBQ3BHLElBQUksT0FBTyxHQUFHLFdBQVcsQ0FBQyxHQUFHLENBQUM7Z0JBQzFCLE1BQU0sQ0FBQyxFQUFFLENBQUM7WUFDZCxDQUFDLENBQUMsQ0FBQztZQUVILElBQUksYUFBYSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLEtBQUssR0FBRyxNQUFNLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxtQkFBbUIsR0FBRyxJQUFJLENBQUMsQ0FBQztZQUMvRixFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUNsQixhQUFhLElBQUksSUFBSSxDQUFDLGtCQUFrQixDQUFDO1lBQzdDLENBQUM7WUFFRCxJQUFJLGFBQWEsR0FBRyxxQkFBcUIsQ0FBQztZQUUxQyxJQUFJLFNBQVMsR0FBRyxFQUFFLENBQUM7WUFDbkIsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxhQUFhLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztnQkFDckMsU0FBUyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLEVBQUUsR0FBRyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUNwRyxDQUFDO1lBRUQsSUFBSSxNQUFNLEdBQUc7Z0JBQ1QsT0FBTyxDQUFDLE9BQU8sQ0FBQyxVQUFDLE1BQU07b0JBQ25CLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO2dCQUN0QixDQUFDLENBQUMsQ0FBQztnQkFDSCxTQUFTLENBQUMsT0FBTyxDQUFDLFVBQUMsUUFBUTtvQkFDdkIsRUFBRSxDQUFDLENBQUMsUUFBUSxDQUFDLEdBQUcsR0FBRyxLQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDO3dCQUN2QyxLQUFLLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUM7b0JBQ3RDLENBQUM7b0JBQ0QsSUFBSSxDQUFDLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQztvQkFDbkIsSUFBSSxDQUFDLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQztvQkFDbkIsSUFBSSxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLDZCQUE2QjtvQkFDbEQsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUNiLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDO3dCQUNiLFFBQVEsQ0FBQyxHQUFHLEdBQUcsS0FBSSxDQUFDLGdCQUFnQixDQUFDLENBQUMsb0RBQW9EO29CQUM5RixDQUFDO29CQUFDLElBQUksQ0FBQyxDQUFDO3dCQUNKLElBQUksRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7d0JBQ2xCLElBQUksRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7d0JBQ2xCLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQzs0QkFDNUIsOEZBQThGOzRCQUM5RixRQUFRLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQzs0QkFDakIsUUFBUSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUM7NEJBQ2pCLE9BQU8sQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO3dCQUNwRCxDQUFDO3dCQUFDLElBQUksQ0FBQyxDQUFDOzRCQUNKLGdFQUFnRTs0QkFDaEUsUUFBUSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUM7NEJBQ2hCLFFBQVEsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDO3dCQUNwQixDQUFDO29CQUNMLENBQUM7b0JBQ0QsUUFBUSxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUM7Z0JBQ3RCLENBQUMsQ0FBQyxDQUFDO1lBQ1AsQ0FBQyxDQUFBO1lBRUQsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDckMsQ0FBQyxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsbUJBQW1CLENBQUM7WUFDdkMsQ0FBQyxDQUFDLFNBQVMsR0FBRyxhQUFhLENBQUM7WUFDNUIsQ0FBQyxDQUFDLFdBQVcsR0FBRyxHQUFHLENBQUM7WUFFcEIsSUFBSSxJQUFJLEdBQUc7Z0JBQ1AsaUNBQWlDO2dCQUNqQyxJQUFJLElBQUksR0FBRyxTQUFTLENBQUM7Z0JBQ3JCLENBQUMsQ0FBQyx3QkFBd0IsR0FBRyxnQkFBZ0IsQ0FBQztnQkFDOUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLEtBQUssRUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBQzVELENBQUMsQ0FBQyx3QkFBd0IsR0FBRyxJQUFJLENBQUM7Z0JBQ2xDLENBQUMsQ0FBQyxXQUFXLEdBQUcsR0FBRyxDQUFDO2dCQUVwQiw0QkFBNEI7Z0JBQzVCLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBQyxNQUFNLEVBQUUsQ0FBQztvQkFDdEIsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO3dCQUNwQixDQUFDLENBQUMsU0FBUyxFQUFFLENBQUM7d0JBQ2QsQ0FBQyxDQUFDLFdBQVcsR0FBRyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7d0JBQy9CLE1BQU0sQ0FBQyxPQUFPLENBQUMsVUFBQyxRQUFROzRCQUNwQixDQUFDLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDOzRCQUNqQyxDQUFDLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxFQUFFLEVBQUUsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDOzRCQUNuQyxRQUFRLENBQUMsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxFQUFFLENBQUM7NEJBQ3pCLFFBQVEsQ0FBQyxDQUFDLEdBQUcsUUFBUSxDQUFDLEVBQUUsQ0FBQzt3QkFDN0IsQ0FBQyxDQUFDLENBQUM7d0JBQ0gsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDO29CQUNmLENBQUM7Z0JBQ0wsQ0FBQyxDQUFDLENBQUM7WUFDUCxDQUFDLENBQUE7WUFFRCxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7WUFDdEIsSUFBSSxLQUFLLEdBQUc7Z0JBQ1IsS0FBSyxDQUFDLGFBQWEsR0FBRyxxQkFBcUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDbkQsSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO2dCQUNyQixJQUFJLEtBQUssR0FBRyxHQUFHLEdBQUcsSUFBSSxDQUFDO2dCQUN2QixFQUFFLENBQUMsQ0FBQyxLQUFLLEdBQUcsS0FBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7b0JBQzFCLElBQUksR0FBRyxHQUFHLEdBQUcsS0FBSyxHQUFHLEtBQUksQ0FBQyxVQUFVLENBQUM7b0JBQ3JDLE1BQU0sRUFBRSxDQUFDO29CQUNULElBQUksRUFBRSxDQUFDO2dCQUNYLENBQUM7WUFDTCxDQUFDLENBQUM7WUFDRixLQUFLLEVBQUUsQ0FBQztRQUNaLENBQUM7UUFDTCxZQUFDO0lBQUQsQ0Eva0JBLEFBK2tCQyxJQUFBO0lBRUQsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDO1FBQy9CLE1BQU0sQ0FBQyxvQkFBb0IsR0FBRyxVQUFDLEVBQUU7WUFDN0IsWUFBWSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ3JCLENBQUMsQ0FBQztJQUNOLENBQUMiLCJmaWxlIjoiYW5pbWF0ZWRFbnZpcm9ubWVudExheWVyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXHJcbi8vIFRoZSBNSVQgTGljZW5zZSAoTUlUKVxyXG4vL1xyXG4vLyBDb3B5cmlnaHQgKGMpIDIwMTcgTmljayBDYW1lcm9uXHJcbi8vXHJcbi8vIGh0dHBzOi8vZ2l0aHViLmNvbS9uaWNrY2FtL0FuaW1hdGVkRW52aXJvbm1lbnRMYXllclxyXG4vL1xyXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYSBcclxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZSBcIlNvZnR3YXJlXCIpLCBcclxuLy8gdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nIHdpdGhvdXQgbGltaXRhdGlvbiBcclxuLy8gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIFxyXG4vLyBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0IHBlcnNvbnMgdG8gd2hvbSB0aGUgXHJcbi8vIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnM6XHJcblxyXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBcclxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXHJcblxyXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTIFxyXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSwgXHJcbi8vIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOIE5PIEVWRU5UIFNIQUxMIFxyXG4vLyBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSwgREFNQUdFUyBPUiBPVEhFUlxyXG4vLyBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBcclxuLy8gT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBcclxuLy8gVEhFIFNPRlRXQVJFLlxyXG4vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cclxuXHJcbmltcG9ydCAqIGFzIE1hcFZpZXcgZnJvbSBcImVzcmkvdmlld3MvTWFwVmlld1wiO1xyXG5pbXBvcnQgKiBhcyBTY2VuZVZpZXcgZnJvbSBcImVzcmkvdmlld3MvU2NlbmVWaWV3XCI7XHJcbmltcG9ydCAqIGFzIEdyYXBoaWNzTGF5ZXIgZnJvbSBcImVzcmkvbGF5ZXJzL0dyYXBoaWNzTGF5ZXJcIjtcclxuaW1wb3J0ICogYXMgcHJvbWlzZVV0aWxzIGZyb20gXCJlc3JpL2NvcmUvcHJvbWlzZVV0aWxzXCI7XHJcbmltcG9ydCAqIGFzIGVzcmlSZXF1ZXN0IGZyb20gXCJlc3JpL3JlcXVlc3RcIjtcclxuaW1wb3J0ICogYXMgRXh0ZW50IGZyb20gXCJlc3JpL2dlb21ldHJ5L0V4dGVudFwiO1xyXG5pbXBvcnQgKiBhcyB3ZWJNZXJjYXRvclV0aWxzIGZyb20gXCJlc3JpL2dlb21ldHJ5L3N1cHBvcnQvd2ViTWVyY2F0b3JVdGlsc1wiO1xyXG5pbXBvcnQgKiBhcyB3YXRjaFV0aWxzIGZyb20gXCJlc3JpL2NvcmUvd2F0Y2hVdGlsc1wiO1xyXG5pbXBvcnQgKiBhcyBTcGF0aWFsUmVmZXJlbmNlIGZyb20gXCJlc3JpL2dlb21ldHJ5L1NwYXRpYWxSZWZlcmVuY2VcIjtcclxuaW1wb3J0ICogYXMgUG9pbnQgZnJvbSBcImVzcmkvZ2VvbWV0cnkvUG9pbnRcIjtcclxuaW1wb3J0ICogYXMgYXNkIGZyb20gXCJlc3JpL2NvcmUvYWNjZXNzb3JTdXBwb3J0L2RlY29yYXRvcnNcIjtcclxuaW1wb3J0ICogYXMgcXVlcnkgZnJvbSBcImRvam8vcXVlcnlcIjtcclxuXHJcbi8qKiBcclxuICAgIFRoZSBhdmFpbGFibGUgZGlzcGxheSBvcHRpb25zIHRvIGNoYW5lZyB0aGUgcGFydGljbGUgcmVuZGVyaW5nXHJcbiovXHJcbmV4cG9ydCBpbnRlcmZhY2UgRGlzcGxheU9wdGlvbnMge1xyXG4gICAgbWluVmVsb2NpdHk/OiBudW1iZXI7XHJcbiAgICBtYXhWZWxvY2l0eT86IG51bWJlcjtcclxuICAgIHZlbG9jaXR5U2NhbGU/OiBudW1iZXI7XHJcbiAgICBwYXJ0aWNsZUFnZT86IG51bWJlcjtcclxuICAgIHBhcnRpY2xlTGluZVdpZHRoPzogbnVtYmVyO1xyXG4gICAgcGFydGljbGVNdWx0aXBsaWVyPzogbnVtYmVyO1xyXG4gICAgcGFydGljbGVNdWx0aXBsaWVyQnlab29tPzogUGFydGljbGVNdWx0aXBsaWVyQnlab29tLFxyXG4gICAgZnJhbWVSYXRlPzogbnVtYmVyO1xyXG4gICAgY29sb3JTY2FsZT86IHN0cmluZ1tdO1xyXG4gICAgbGluZVdpZHRoPzogbnVtYmVyO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAgICBBbiBzaW1wbGUgb2JqZWN0IHRvIGRlZmluZSBkeW5hbWljIHBhcnRpY2xlIG11bHRpcGxpZXJzIGRlcGVuZGluZyBvbiBjdXJyZW50IHpvb20gbGV2ZWwuXHJcbiAgICBBIGJhc2ljIGF0dGVtcHQgdG8gY2F0ZXIgZm9yIHBhcnRpY2xlcyBkaXNwbGF5aW5nIHRvbyBkZW5zZWx5IG9uIGNsb3NlIGluIHpvb20gbGV2ZWxzLlxyXG4qL1xyXG5leHBvcnQgaW50ZXJmYWNlIFBhcnRpY2xlTXVsdGlwbGllckJ5Wm9vbSB7XHJcbiAgICAvLyB0aGUgYmFzZSB6b29tIGxldmVsIHRvIHN0YXJ0IGNhbGN1bGF0aW5nIGF0LiBGaW5kIGEgcGFyaXRpY2xlIG11bHRpcGxlciBhdCB0aGlzIHpvb20gbGV2ZWwgdGhhdCBsb29rcyBnb29kIGZvciB5b3VyIGRhdGEuXHJcbiAgICB6b29tTGV2ZWw6IG51bWJlcixcclxuXHJcbiAgICAvLyBUaGUgcGFydGljbGUgbXVsdGlwbGllciBmb3IgdGhlIGJhc2Ugem9vbSBsZXZlbCBzcGVjaWZpZWQgYWJvdmUuIEZpbmQgYSBwYXJ0aWNsZSBtdWx0aXBsZXIgYXQgdGhpcyB6b29tIGxldmVsIHRoYXQgbG9va3MgZ29vZCBmb3IgeW91ciBkYXRhLlxyXG4gICAgcGFydGljbGVNdWx0aXBsaWVyOiBudW1iZXIsXHJcblxyXG4gICAgLy8gVGhlIGFtb3VudCB0byBzdWJ0cmFjdCBvciBhZGQgdG8gdGhlIHBhcnRpY2xlIG11bHRpcGxpZXIgZGVwZW5kaW5nIG9uIHpvb20gbGV2ZWxcclxuICAgIGRpZmZSYXRpbzogbnVtYmVyLFxyXG5cclxuICAgIC8vIHRoZSBtaW4gdmFsdWUgdGhlIG11bHRpcGxpZXIgY2FuIGdvXHJcbiAgICBtaW5NdWx0aXBsaWVyOiBudW1iZXIsXHJcblxyXG4gICAgLy8gdGhlIG1heCB2YWx1ZSB0aGUgbXVsdGlwbGllciBjYW4gZ29cclxuICAgIG1heE11bHRpcGxpZXI6IG51bWJlclxyXG59XHJcblxyXG5cclxuLyoqXHJcbiBUaGUgcmV0dXJuIG9iamVjdCBmcm9tIHRoZSBwb2ludC1yZXBvcnQgZXZlbnRcclxuKi9cclxuZXhwb3J0IGludGVyZmFjZSBQb2ludFJlcG9ydCB7XHJcbiAgICBwb2ludDogUG9pbnQ7XHJcbiAgICB0YXJnZXQ6IEFuaW1hdGVkRW52aXJvbm1lbnRMYXllcjtcclxuICAgIGRlZ3JlZT86IG51bWJlcjtcclxuICAgIHZlbG9jaXR5PzogbnVtYmVyO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEFuaW1hdGVkRW52aXJvbm1lbnRMYXllclByb3BlcnRpZXMgZXh0ZW5kcyBfX2VzcmkuR3JhcGhpY3NMYXllclByb3BlcnRpZXMge1xyXG4gICAgYWN0aXZlVmlldz86IE1hcFZpZXcgfCBTY2VuZVZpZXc7XHJcbiAgICB1cmw/OiBzdHJpbmc7XHJcbiAgICBkaXNwbGF5T3B0aW9ucz86IERpc3BsYXlPcHRpb25zO1xyXG4gICAgcmVwb3J0VmFsdWVzPzogYm9vbGVhbjtcclxufVxyXG5cclxuQGFzZC5zdWJjbGFzcyhcIkFuaW1hdGVkRW52aXJvbm1lbnRMYXllclwiKVxyXG5leHBvcnQgY2xhc3MgQW5pbWF0ZWRFbnZpcm9ubWVudExheWVyIGV4dGVuZHMgYXNkLmRlY2xhcmVkKEdyYXBoaWNzTGF5ZXIpIHtcclxuXHJcbiAgICBAYXNkLnByb3BlcnR5KClcclxuICAgIHVybDogc3RyaW5nO1xyXG5cclxuICAgIEBhc2QucHJvcGVydHkoKVxyXG4gICAgZGlzcGxheU9wdGlvbnM6IERpc3BsYXlPcHRpb25zO1xyXG5cclxuICAgIEBhc2QucHJvcGVydHkoKVxyXG4gICAgcmVwb3J0VmFsdWVzOiBib29sZWFuO1xyXG5cclxuICAgIEBhc2QucHJvcGVydHkoKVxyXG4gICAgZGF0YUxvYWRpbmc6IGJvb2xlYW47XHJcblxyXG4gICAgQGFzZC5wcm9wZXJ0eSgpXHJcbiAgICBpc0Vycm9yZWQ6IGJvb2xlYW47XHJcblxyXG4gICAgcHJpdmF0ZSBfd2luZHk6IFdpbmR5O1xyXG4gICAgcHJpdmF0ZSBfZGF0YUZldGNoUmVxdWlyZWQ6IGJvb2xlYW47XHJcblxyXG4gICAgcHJpdmF0ZSBfY2FudmFzMmQ6IEhUTUxDYW52YXNFbGVtZW50O1xyXG4gICAgcHJpdmF0ZSBfY2FudmFzM2Q6IEhUTUxDYW52YXNFbGVtZW50O1xyXG5cclxuICAgIHByaXZhdGUgX2xheWVyVmlldzJkOiBhbnk7XHJcbiAgICBwcml2YXRlIF9sYXllclZpZXczZDogYW55O1xyXG5cclxuICAgIHByaXZhdGUgX3NvdXRoV2VzdDogUG9pbnQ7XHJcbiAgICBwcml2YXRlIF9ub3J0aEVhc3Q6IFBvaW50O1xyXG5cclxuICAgIHByaXZhdGUgX2FjdGl2ZVZpZXc6IE1hcFZpZXcgfCBTY2VuZVZpZXc7XHJcbiAgICBwcml2YXRlIF92aWV3TG9hZENvdW50OiBudW1iZXIgPSAwO1xyXG5cclxuICAgIHByaXZhdGUgX2lzRHJhd2luZzogYm9vbGVhbiA9IGZhbHNlO1xyXG4gICAgcHJpdmF0ZSBfcXVldWVkRHJhdzogYm9vbGVhbjtcclxuXHJcblxyXG4gICAgZGF0ZTogRGF0ZTtcclxuXHJcbiAgICBjb25zdHJ1Y3Rvcihwcm9wZXJ0aWVzOiBBbmltYXRlZEVudmlyb25tZW50TGF5ZXJQcm9wZXJ0aWVzKSB7XHJcbiAgICAgICAgc3VwZXIocHJvcGVydGllcyk7XHJcblxyXG4gICAgICAgIC8vIElmIHRoZSBhY3RpdmUgdmlldyBpcyBzZXQgaW4gcHJvcGVydGllcywgdGhlbiBzZXQgaXQgaGVyZS5cclxuICAgICAgICB0aGlzLl9hY3RpdmVWaWV3ID0gcHJvcGVydGllcy5hY3RpdmVWaWV3O1xyXG4gICAgICAgIHRoaXMudXJsID0gcHJvcGVydGllcy51cmw7XHJcbiAgICAgICAgdGhpcy5kaXNwbGF5T3B0aW9ucyA9IHByb3BlcnRpZXMuZGlzcGxheU9wdGlvbnMgfHwge307XHJcbiAgICAgICAgdGhpcy5yZXBvcnRWYWx1ZXMgPSBwcm9wZXJ0aWVzLnJlcG9ydFZhbHVlcyA9PT0gZmFsc2UgPyBmYWxzZSA6IHRydWU7IC8vIGRlZmF1bHQgdG8gdHJ1ZVxyXG5cclxuICAgICAgICB0aGlzLm9uKFwibGF5ZXJ2aWV3LWNyZWF0ZVwiLCAoZXZ0KSA9PiB0aGlzLl9sYXllclZpZXdDcmVhdGVkKGV2dCkpO1xyXG5cclxuICAgICAgICAvLyB3YXRjaCB1cmwgcHJvcCBzbyBhIGZldGNoIG9mIGRhdGEgYW5kIHJlZHJhdyB3aWxsIG9jY3VyLlxyXG4gICAgICAgIHdhdGNoVXRpbHMud2F0Y2godGhpcywgXCJ1cmxcIiwgKGEsIGIsIGMsIGQpID0+IHRoaXMuX3VybENoYW5nZWQoYSwgYiwgYywgZCkpO1xyXG5cclxuICAgICAgICAvLyB3YXRjaCB1cmwgcHJvcCBzbyBhIGZldGNoIG9mIGRhdGEgYW5kIHJlZHJhdyB3aWxsIG9jY3VyLlxyXG4gICAgICAgIHdhdGNoVXRpbHMud2F0Y2godGhpcywgXCJ2aXNpYmxlXCIsIChhLCBiLCBjLCBkKSA9PiB0aGlzLl92aXNpYmxlQ2hhbmdlZChhLCBiLCBjLCBkKSk7XHJcblxyXG4gICAgICAgIC8vIHdhdGNoIGRpc3BsYXkgb3B0aW9ucyBzbyB0byByZWRyYXcgd2hlbiBjaGFuZ2VkLlxyXG4gICAgICAgIHdhdGNoVXRpbHMud2F0Y2godGhpcywgXCJkaXNwbGF5T3B0aW9uc1wiLCAoYSwgYiwgYywgZCkgPT4gdGhpcy5fZGlzcGxheU9wdGlvbnNDaGFuZ2VkKGEsIGIsIGMsIGQpKTtcclxuICAgICAgICB0aGlzLl9kYXRhRmV0Y2hSZXF1aXJlZCA9IHRydWU7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBTdGFydCBhIGRyYXdcclxuICAgICAqL1xyXG4gICAgZHJhdyhmb3JjZURhdGFSZWZldGNoPzogYm9vbGVhbikge1xyXG5cclxuICAgICAgICBpZiAoZm9yY2VEYXRhUmVmZXRjaCAhPSBudWxsKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2RhdGFGZXRjaFJlcXVpcmVkID0gZm9yY2VEYXRhUmVmZXRjaDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICghdGhpcy51cmwgfHwgIXRoaXMudmlzaWJsZSkgcmV0dXJuOyAvLyBubyB1cmwgc2V0LCBub3QgdmlzaWJsZSBvciBpcyBjdXJyZW50bHkgZHJhd2luZywgZXhpdCBoZXJlLlxyXG5cclxuICAgICAgICB0aGlzLl9pc0RyYXdpbmcgPSB0cnVlO1xyXG4gICAgICAgIHRoaXMuX3NldHVwRHJhdyh0aGlzLl9hY3RpdmVWaWV3LndpZHRoLCB0aGlzLl9hY3RpdmVWaWV3LmhlaWdodCk7XHJcblxyXG4gICAgICAgIC8vIGlmIGRhdGEgc2hvdWxkIGJlIGZldGNoZWQsIGdvIGdldCBpdCBub3cuXHJcbiAgICAgICAgaWYgKHRoaXMuX2RhdGFGZXRjaFJlcXVpcmVkKSB7XHJcbiAgICAgICAgICAgIHRoaXMuaXNFcnJvcmVkID0gZmFsc2U7XHJcbiAgICAgICAgICAgIHRoaXMuZGF0YUxvYWRpbmcgPSB0cnVlO1xyXG5cclxuICAgICAgICAgICAgZXNyaVJlcXVlc3QodGhpcy51cmwsIHtcclxuICAgICAgICAgICAgICAgIHJlc3BvbnNlVHlwZTogXCJqc29uXCJcclxuICAgICAgICAgICAgfSlcclxuICAgICAgICAgICAgLnRoZW4oKHJlc3BvbnNlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9kYXRhRmV0Y2hSZXF1aXJlZCA9IGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fd2luZHkuc2V0RGF0YShyZXNwb25zZS5kYXRhKVxyXG4gICAgICAgICAgICAgICAgdGhpcy5fZG9EcmF3KCk7IC8vIGFsbCBzb3J0ZWQgZHJhdyBub3cuXHJcbiAgICAgICAgICAgICAgICB0aGlzLmRhdGFMb2FkaW5nID0gZmFsc2U7XHJcbiAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgIC5vdGhlcndpc2UoKGVycikgPT4ge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIG9jY3VycmVkIHJldHJpZXZpbmcgZGF0YS4gXCIgKyBlcnIpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5kYXRhTG9hZGluZyA9IGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5pc0Vycm9yZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIC8vIG5vIG5lZWQgZm9yIGRhdGEsIGp1c3QgZHJhdy5cclxuICAgICAgICAgICAgdGhpcy5fZG9EcmF3KCk7XHJcblxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFVwZGF0ZSB0aGUgYWN0aXZlIHZpZXcuIFRoZSB2aWV3IG11c3QgaGF2ZSBiZWVuIGFzc2lnbmVkIHRvIHRoZSBtYXAgcHJldmlvdXNseSBzbyB0aGF0IHRoaXMgbGF5ZXIgaGFzIGNyZWF0ZWQgb3IgdXNlZCB0aGUgY2FudmFzIGVsZW1lbnQgaW4gbGF5ZXJ2aWV3IGNyZWF0ZWQgYWxyZWFkeS5cclxuICAgICAqIEBwYXJhbSB2aWV3XHJcbiAgICAgKi9cclxuICAgIHNldFZpZXcodmlldzogTWFwVmlldyB8IFNjZW5lVmlldykge1xyXG4gICAgICAgIHRoaXMuX2FjdGl2ZVZpZXcgPSB2aWV3O1xyXG4gICAgICAgIHRoaXMuZHJhdygpO1xyXG4gICAgfVxyXG5cclxuICAgIHN0b3AoKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuX3dpbmR5KSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3dpbmR5LnN0b3AoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgc3RhcnQoKSB7XHJcbiAgICAgICAgdGhpcy5kcmF3KCk7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIC8qKlxyXG4gICAgICogSXMgdGhlIGFjdGl2ZSB2aWV3IDJkLlxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF9pczJkKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9hY3RpdmVWaWV3ID8gdGhpcy5fYWN0aXZlVmlldy50eXBlID09PSBcIjJkXCIgOiBmYWxzZTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENhbGwgdGhlIHdpbmR5IGRyYXcgbWV0aG9kXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgX2RvRHJhdygpIHtcclxuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuX2lzMmQoKSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fd2luZHkuc3RhcnQoXHJcbiAgICAgICAgICAgICAgICAgICAgW1swLCAwXSwgW3RoaXMuX2NhbnZhczJkLndpZHRoLCB0aGlzLl9jYW52YXMyZC5oZWlnaHRdXSxcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9jYW52YXMyZC53aWR0aCxcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9jYW52YXMyZC5oZWlnaHQsXHJcbiAgICAgICAgICAgICAgICAgICAgW1t0aGlzLl9zb3V0aFdlc3QueCwgdGhpcy5fc291dGhXZXN0LnldLCBbdGhpcy5fbm9ydGhFYXN0LngsIHRoaXMuX25vcnRoRWFzdC55XV1cclxuICAgICAgICAgICAgICAgICk7XHJcblxyXG4gICAgICAgICAgICAgICAgdGhpcy5fc2V0RGF0ZSgpO1xyXG5cclxuICAgICAgICAgICAgICAgIHRoaXMuX2lzRHJhd2luZyA9IGZhbHNlO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIGlmIHdlIGhhdmUgYSBxdWV1ZWQgZHJhdyBkbyBpdCByaWdodCBub3cuXHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fcXVldWVkRHJhdykge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3F1ZXVlZERyYXcgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmRyYXcoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sIDUwMCk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBJbml0IHRoZSB3aW5keSBjbGFzcyBcclxuICAgICAqIEBwYXJhbSBkYXRhXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgX2luaXRXaW5keShkYXRhPykge1xyXG4gICAgICAgIGlmICh0aGlzLl9pczJkKCkpIHtcclxuICAgICAgICAgICAgdGhpcy5fd2luZHkgPSBuZXcgV2luZHkoXHJcbiAgICAgICAgICAgICAgICB0aGlzLl9jYW52YXMyZCxcclxuICAgICAgICAgICAgICAgIHVuZGVmaW5lZCxcclxuICAgICAgICAgICAgICAgIHRoaXMuZGlzcGxheU9wdGlvbnMpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFNldHVwIHRoZSBnZW8gYm91bmRzIG9mIHRoZSBkcmF3aW5nIGFyZWFcclxuICAgICAqIEBwYXJhbSB3aWR0aFxyXG4gICAgICogQHBhcmFtIGhlaWdodFxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF9zZXR1cERyYXcod2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIpIHtcclxuXHJcbiAgICAgICAgLy8gdXNlIHRoZSBleHRlbnQgb2YgdGhlIHZpZXcsIGFuZCBub3QgdGhlIGV4dGVudCBwYXNzZWQgaW50byBmZXRjaEltYWdlLi4uaXQgd2FzIHNsaWdodGx5IG9mZiB3aGVuIGl0IGNyb3NzZWQgSURMLlxyXG4gICAgICAgIGxldCBleHRlbnQgPSB0aGlzLl9hY3RpdmVWaWV3LmV4dGVudDtcclxuICAgICAgICBpZiAoZXh0ZW50LnNwYXRpYWxSZWZlcmVuY2UuaXNXZWJNZXJjYXRvcikge1xyXG4gICAgICAgICAgICBleHRlbnQgPSA8RXh0ZW50PndlYk1lcmNhdG9yVXRpbHMud2ViTWVyY2F0b3JUb0dlb2dyYXBoaWMoZXh0ZW50KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuX25vcnRoRWFzdCA9IG5ldyBQb2ludCh7IHg6IGV4dGVudC54bWF4LCB5OiBleHRlbnQueW1heCB9KTtcclxuICAgICAgICB0aGlzLl9zb3V0aFdlc3QgPSBuZXcgUG9pbnQoeyB4OiBleHRlbnQueG1pbiwgeTogZXh0ZW50LnltaW4gfSk7XHJcblxyXG4gICAgICAgIGlmICh0aGlzLl9pczJkKCkpIHtcclxuICAgICAgICAgICAgdGhpcy5fY2FudmFzMmQud2lkdGggPSB3aWR0aDtcclxuICAgICAgICAgICAgdGhpcy5fY2FudmFzMmQuaGVpZ2h0ID0gaGVpZ2h0O1xyXG4gICAgICAgICAgICAvLyBjYXRlciBmb3IgdGhlIGV4dGVudCBjcm9zc2luZyB0aGUgSURMXHJcbiAgICAgICAgICAgIGlmICh0aGlzLl9zb3V0aFdlc3QueCA+IHRoaXMuX25vcnRoRWFzdC54ICYmIHRoaXMuX25vcnRoRWFzdC54IDwgMCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fbm9ydGhFYXN0LnggPSAzNjAgKyB0aGlzLl9ub3J0aEVhc3QueDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEhhbmRsZSBsYXllciB2aWV3IGNyZWF0ZWQuXHJcbiAgICAgKiBAcGFyYW0gZXZ0XHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgX2xheWVyVmlld0NyZWF0ZWQoZXZ0KSB7XHJcbiAgICAgICAgLy8gc2V0IHRoZSBhY3RpdmUgdmlldyB0byB0aGUgZmlyc3QgdmlldyBsb2FkZWQgaWYgdGhlcmUgd2Fzbid0IG9uZSBpbmNsdWRlZCBpbiB0aGUgY29uc3RydWN0b3IgcHJvcGVydGllcy5cclxuICAgICAgICB0aGlzLl92aWV3TG9hZENvdW50Kys7XHJcbiAgICAgICAgaWYgKHRoaXMuX3ZpZXdMb2FkQ291bnQgPT09IDEgJiYgIXRoaXMuX2FjdGl2ZVZpZXcpIHtcclxuICAgICAgICAgICAgdGhpcy5fYWN0aXZlVmlldyA9IGV2dC5sYXllclZpZXcudmlldztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICh0aGlzLl9pczJkKCkpIHtcclxuICAgICAgICAgICAgdGhpcy5fbGF5ZXJWaWV3MmQgPSBldnQubGF5ZXJWaWV3O1xyXG4gICAgICAgICAgICAvLyBmb3IgbWFwIHZpZXdzLCB3YWl0IGZvciB0aGUgbGF5ZXJ2aWV3IHRvIGJlIGF0dGFjaGVkXHJcbiAgICAgICAgICAgIHdhdGNoVXRpbHMud2hlblRydWVPbmNlKGV2dC5sYXllclZpZXcsIFwiYXR0YWNoZWRcIiwgKCkgPT4gdGhpcy5fY3JlYXRlQ2FudmFzKGV2dC5sYXllclZpZXcpKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2xheWVyVmlldzNkID0gZXZ0LmxheWVyVmlldztcclxuICAgICAgICAgICAgdGhpcy5fY3JlYXRlQ2FudmFzKGV2dC5sYXllclZpZXcpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB3YXRjaFV0aWxzLnBhdXNhYmxlKGV2dC5sYXllclZpZXcudmlldywgXCJzdGF0aW9uYXJ5XCIsIChpc1N0YXRpb25hcnksIGIsIGMsIHZpZXcpID0+IHRoaXMuX3ZpZXdTdGF0aW9uYXJ5KGlzU3RhdGlvbmFyeSwgYiwgYywgdmlldykpO1xyXG5cclxuICAgICAgICBpZiAodGhpcy5yZXBvcnRWYWx1ZXMgPT09IHRydWUpIHtcclxuICAgICAgICAgICAgZXZ0LmxheWVyVmlldy52aWV3Lm9uKFwicG9pbnRlci1tb3ZlXCIsIChldnQpID0+IHRoaXMuX3ZpZXdQb2ludGVyTW92ZShldnQpKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlIG9yIGFzc2lnbiBhIGNhbnZhcyBlbGVtZW50IGZvciB1c2UgaW4gZHJhd2luZy5cclxuICAgICAqIEBwYXJhbSBsYXllclZpZXdcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBfY3JlYXRlQ2FudmFzKGxheWVyVmlldykge1xyXG4gICAgICAgIGlmICh0aGlzLl9pczJkKCkpIHtcclxuICAgICAgICAgICAgLy8gRm9yIGEgbWFwIHZpZXcgZ2V0IHRoZSBjb250YWluZXIgZWxlbWVudCBvZiB0aGUgbGF5ZXIgdmlldyBhbmQgYWRkIGEgY2FudmFzIHRvIGl0LlxyXG4gICAgICAgICAgICB0aGlzLl9jYW52YXMyZCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJjYW52YXNcIik7XHJcbiAgICAgICAgICAgIGxheWVyVmlldy5jb250YWluZXIuZWxlbWVudC5hcHBlbmRDaGlsZCh0aGlzLl9jYW52YXMyZCk7XHJcblxyXG4gICAgICAgICAgICAvLyBkZWZhdWx0IHNvbWUgc3R5bGVzIFxyXG4gICAgICAgICAgICB0aGlzLl9jYW52YXMyZC5zdHlsZS5wb3NpdGlvbiA9IFwiYWJzb2x1dGVcIjtcclxuICAgICAgICAgICAgdGhpcy5fY2FudmFzMmQuc3R5bGUubGVmdCA9IFwiMFwiO1xyXG4gICAgICAgICAgICB0aGlzLl9jYW52YXMyZC5zdHlsZS50b3AgPSBcIjBcIjtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIC8vIEhhbmRsZSBzY2VuZSB2aWV3IGNhbnZhcyBpbiBmdXR1cmUuICAgICAgICAgICAgXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBzZXR1cCB3aW5keSBvbmNlIHRoZSBjYW52YXMgaGFzIGJlZW4gY3JlYXRlZFxyXG4gICAgICAgIHRoaXMuX2luaXRXaW5keSgpO1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICAvKipcclxuICAgICAqIHZpZXcgc3RhdGlvbmFyeSBoYW5kbGVyLCBjbGVhciBjYW52YXMgb3IgZm9yY2UgYSByZWRyYXdcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBfdmlld1N0YXRpb25hcnkoaXNTdGF0aW9uYXJ5LCBiLCBjLCB2aWV3KSB7XHJcbiAgICAgICAgaWYgKCF0aGlzLl9hY3RpdmVWaWV3KSByZXR1cm47XHJcblxyXG4gICAgICAgIGlmICghaXNTdGF0aW9uYXJ5KSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLl93aW5keSkge1xyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2lzMmQoKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3dpbmR5LnN0b3AoKTsgLy8gZm9yY2UgYSBzdG9wIG9mIHdpbmR5IHdoZW4gdmlldyBpcyBtb3ZpbmdcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9jYW52YXMyZC5nZXRDb250ZXh0KFwiMmRcIikuY2xlYXJSZWN0KDAsIDAsIHRoaXMuX2FjdGl2ZVZpZXcud2lkdGgsIHRoaXMuX2FjdGl2ZVZpZXcuaGVpZ2h0KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuX2lzRHJhd2luZykge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fcXVldWVkRHJhdyA9IHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSB7XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZGlzcGxheU9wdGlvbnMucGFydGljbGVNdWx0aXBsaWVyQnlab29tKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2V0UGFydGljbGVNdWx0aXBsaWVyKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgdGhpcy5kcmF3KCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfc2V0UGFydGljbGVNdWx0aXBsaWVyKCkge1xyXG4gICAgICAgIGxldCBjdXJyZW50Wm9vbSA9IHRoaXMuX2FjdGl2ZVZpZXcuem9vbTtcclxuICAgICAgICBsZXQgYmFzZVpvb20gPSB0aGlzLmRpc3BsYXlPcHRpb25zLnBhcnRpY2xlTXVsdGlwbGllckJ5Wm9vbS56b29tTGV2ZWw7XHJcbiAgICAgICAgbGV0IHBtID0gdGhpcy5kaXNwbGF5T3B0aW9ucy5wYXJ0aWNsZU11bHRpcGxpZXJCeVpvb20ucGFydGljbGVNdWx0aXBsaWVyO1xyXG5cclxuICAgICAgICBpZiAoY3VycmVudFpvb20gPiBiYXNlWm9vbSkge1xyXG4gICAgICAgICAgICBsZXQgem9vbURpZmYgPSAoY3VycmVudFpvb20gLSBiYXNlWm9vbSk7XHJcbiAgICAgICAgICAgIHBtID0gdGhpcy5kaXNwbGF5T3B0aW9ucy5wYXJ0aWNsZU11bHRpcGxpZXJCeVpvb20ucGFydGljbGVNdWx0aXBsaWVyIC0gKHpvb21EaWZmICogdGhpcy5kaXNwbGF5T3B0aW9ucy5wYXJ0aWNsZU11bHRpcGxpZXJCeVpvb20uZGlmZlJhdGlvKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSBpZiAoY3VycmVudFpvb20gPCBiYXNlWm9vbSkge1xyXG4gICAgICAgICAgICBsZXQgem9vbURpZmYgPSBiYXNlWm9vbSAtIGN1cnJlbnRab29tO1xyXG4gICAgICAgICAgICBwbSA9IHRoaXMuZGlzcGxheU9wdGlvbnMucGFydGljbGVNdWx0aXBsaWVyQnlab29tLnBhcnRpY2xlTXVsdGlwbGllciArICh6b29tRGlmZiAqIHRoaXMuZGlzcGxheU9wdGlvbnMucGFydGljbGVNdWx0aXBsaWVyQnlab29tLmRpZmZSYXRpbyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAocG0gPCB0aGlzLmRpc3BsYXlPcHRpb25zLnBhcnRpY2xlTXVsdGlwbGllckJ5Wm9vbS5taW5NdWx0aXBsaWVyKSBwbSA9IHRoaXMuZGlzcGxheU9wdGlvbnMucGFydGljbGVNdWx0aXBsaWVyQnlab29tLm1pbk11bHRpcGxpZXI7XHJcbiAgICAgICAgZWxzZSBpZiAocG0gPiB0aGlzLmRpc3BsYXlPcHRpb25zLnBhcnRpY2xlTXVsdGlwbGllckJ5Wm9vbS5tYXhNdWx0aXBsaWVyKSBwbSA9IHRoaXMuZGlzcGxheU9wdGlvbnMucGFydGljbGVNdWx0aXBsaWVyQnlab29tLm1heE11bHRpcGxpZXI7XHJcblxyXG4gICAgICAgIGlmICh0aGlzLl9pczJkKCkgJiYgdGhpcy5fd2luZHkpIHtcclxuICAgICAgICAgICAgdGhpcy5fd2luZHkuUEFSVElDTEVfTVVMVElQTElFUiA9IHBtO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfdmlld1BvaW50ZXJNb3ZlKGV2dCkge1xyXG4gICAgICAgIGlmICghdGhpcy5fd2luZHkgfHwgIXRoaXMudmlzaWJsZSkgcmV0dXJuO1xyXG5cclxuICAgICAgICBsZXQgbW91c2VQb3MgPSB0aGlzLl9nZXRNb3VzZVBvcyhldnQpO1xyXG4gICAgICAgIGxldCBwb2ludCA9IHRoaXMuX2FjdGl2ZVZpZXcudG9NYXAoeyB4OiBtb3VzZVBvcy54LCB5OiBtb3VzZVBvcy55IH0pO1xyXG4gICAgICAgIGlmIChwb2ludC5zcGF0aWFsUmVmZXJlbmNlLmlzV2ViTWVyY2F0b3IpIHtcclxuICAgICAgICAgICAgcG9pbnQgPSA8UG9pbnQ+d2ViTWVyY2F0b3JVdGlscy53ZWJNZXJjYXRvclRvR2VvZ3JhcGhpYyhwb2ludCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgZ3JpZCA9IHRoaXMuX3dpbmR5LmludGVycG9sYXRlKHBvaW50LngsIHBvaW50LnkpO1xyXG4gICAgICAgIGxldCByZXN1bHQ6IFBvaW50UmVwb3J0ID0ge1xyXG4gICAgICAgICAgICBwb2ludDogcG9pbnQsXHJcbiAgICAgICAgICAgIHRhcmdldDogdGhpc1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGlmICghZ3JpZCB8fCAoaXNOYU4oZ3JpZFswXSkgfHwgaXNOYU4oZ3JpZFsxXSkgfHwgIWdyaWRbMl0pKSB7XHJcbiAgICAgICAgICAgIC8vIHRoZSBjdXJyZW50IHBvaW50IGNvbnRhaW5zIG5vIGRhdGEgaW4gdGhlIHdpbmR5IGdyaWQsIHNvIGVtaXQgYW4gb2JqZWN0IHdpdGggbm8gc3BlZWQgb3IgZGlyZWN0aW9uIG9iamVjdFxyXG4gICAgICAgICAgICB0aGlzLmVtaXQoXCJwb2ludC1yZXBvcnRcIiwgcmVzdWx0KTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gZ2V0IHRoZSBzcGVlZCBhbmQgZGlyZWN0aW9uIGFuZCBlbWl0IHRoZSByZXN1bHRcclxuICAgICAgICByZXN1bHQudmVsb2NpdHkgPSB0aGlzLl92ZWN0b3JUb1NwZWVkKGdyaWRbMF0sIGdyaWRbMV0pO1xyXG4gICAgICAgIHJlc3VsdC5kZWdyZWUgPSB0aGlzLl92ZWN0b3JUb0RlZ3JlZXMoZ3JpZFswXSwgZ3JpZFsxXSk7XHJcbiAgICAgICAgdGhpcy5lbWl0KFwicG9pbnQtcmVwb3J0XCIsIHJlc3VsdCk7XHJcblxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ29udmVydCB0aGUgd2luZHkgdmVjdG9yIGRhdGEgdG8gbWV0ZXJzIHBlciBzZWNvbmRcclxuICAgICAqIEBwYXJhbSB1TXNcclxuICAgICAqIEBwYXJhbSB2TXNcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBfdmVjdG9yVG9TcGVlZCh1TXMsIHZNcykge1xyXG4gICAgICAgIGxldCBzcGVlZEFicyA9IE1hdGguc3FydChNYXRoLnBvdyh1TXMsIDIpICsgTWF0aC5wb3codk1zLCAyKSk7XHJcbiAgICAgICAgcmV0dXJuIHNwZWVkQWJzO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmV0dXJuIHRoZSB3aW5keSB2ZWN0b3IgZGF0YSBhcyBhIGRpcmVjdGlvbi4gUmV0dXJucyB0aGUgZGlyZWN0aW9uIG9mIHRoZSBmbG93IG9mIHRoZSBkYXRhIHdpdGggdGhlIGRlZ3JlZXMgaW4gYSBjbG9ja3dpc2UgZGlyZWN0aW9uLlxyXG4gICAgICogQHBhcmFtIHVNc1xyXG4gICAgICogQHBhcmFtIHZNc1xyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF92ZWN0b3JUb0RlZ3JlZXModU1zLCB2TXMpIHtcclxuXHJcbiAgICAgICAgbGV0IGFicyA9IE1hdGguc3FydChNYXRoLnBvdyh1TXMsIDIpICsgTWF0aC5wb3codk1zLCAyKSk7XHJcbiAgICAgICAgbGV0IGRpcmVjdGlvbiA9IE1hdGguYXRhbjIodU1zIC8gYWJzLCB2TXMgLyBhYnMpO1xyXG4gICAgICAgIGxldCBkaXJlY3Rpb25Ub0RlZ3JlZXMgPSBkaXJlY3Rpb24gKiAxODAgLyBNYXRoLlBJICsgMTgwO1xyXG5cclxuICAgICAgICBkaXJlY3Rpb25Ub0RlZ3JlZXMgKz0gMTgwO1xyXG4gICAgICAgIGlmIChkaXJlY3Rpb25Ub0RlZ3JlZXMgPj0gMzYwKSBkaXJlY3Rpb25Ub0RlZ3JlZXMgLT0gMzYwO1xyXG5cclxuICAgICAgICByZXR1cm4gZGlyZWN0aW9uVG9EZWdyZWVzO1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICBwcml2YXRlIF9nZXRNb3VzZVBvcyhldnQpIHtcclxuICAgICAgICAvLyBjb250YWluZXIgb24gdGhlIHZpZXcgaXMgYWN0dWFsbHkgYSBodG1sIGVsZW1lbnQgYXQgdGhpcyBwb2ludCwgbm90IGEgc3RyaW5nIGFzIHRoZSB0eXBpbmdzIHN1Z2dlc3QuXHJcbiAgICAgICAgbGV0IGNvbnRhaW5lcjogYW55ID0gdGhpcy5fYWN0aXZlVmlldy5jb250YWluZXI7XHJcbiAgICAgICAgbGV0IHJlY3QgPSBjb250YWluZXIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgeDogZXZ0LnggLSByZWN0LmxlZnQsXHJcbiAgICAgICAgICAgIHk6IGV2dC55IC0gcmVjdC50b3BcclxuICAgICAgICB9O1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICAvKipcclxuICAgICAqIFdhdGNoIG9mIHRoZSB1cmwgcHJvcGVydHkgLSBjYWxsIGRyYXcgYWdhaW4gd2l0aCBhIHJlZmV0Y2hcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBfdXJsQ2hhbmdlZChhLCBiLCBjLCBkKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuX3dpbmR5KSB0aGlzLl93aW5keS5zdG9wKCk7XHJcbiAgICAgICAgdGhpcy5fZGF0YUZldGNoUmVxdWlyZWQgPSB0cnVlO1xyXG4gICAgICAgIHRoaXMuZHJhdygpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogV2F0Y2ggb2YgdGhlIHVybCBwcm9wZXJ0eSAtIGNhbGwgZHJhdyBhZ2FpbiB3aXRoIGEgcmVmZXRjaFxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF92aXNpYmxlQ2hhbmdlZCh2aXNpYmxlLCBiLCBjLCBkKSB7XHJcbiAgICAgICAgaWYgKCF2aXNpYmxlKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLl93aW5keSkgdGhpcy5fd2luZHkuc3RvcCgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5kcmF3KCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFdhdGNoIG9mIGRpc3BsYXlPcHRpb25zIC0gY2FsbCBkcmF3IGFnYWluIHdpdGggbmV3IG9wdGlvbnMgc2V0IG9uIHdpbmR5LlxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF9kaXNwbGF5T3B0aW9uc0NoYW5nZWQobmV3T3B0aW9ucywgYiwgYywgZCkge1xyXG4gICAgICAgIGlmICghdGhpcy5fd2luZHkpIHJldHVybjtcclxuICAgICAgICB0aGlzLl93aW5keS5zdG9wKCk7XHJcbiAgICAgICAgdGhpcy5fd2luZHkuc2V0RGlzcGxheU9wdGlvbnMobmV3T3B0aW9ucyk7XHJcbiAgICAgICAgdGhpcy5kcmF3KCk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfc2V0RGF0ZSgpIHtcclxuICAgICAgICBpZiAodGhpcy5faXMyZCgpICYmIHRoaXMuX3dpbmR5KSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLl93aW5keS5yZWZUaW1lICYmIHRoaXMuX3dpbmR5LmZvcmVjYXN0VGltZSkge1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIGFzc3VtZSB0aGUgcmVmIHRpbWUgaXMgYW4gaXNvIHN0cmluZywgb3Igc29tZSBvdGhlciBlcXVpdmFsZW50IHRoYXQgamF2YXNjcmlwdCBEYXRlIG9iamVjdCBjYW4gcGFyc2UuXHJcbiAgICAgICAgICAgICAgICBsZXQgZCA9IG5ldyBEYXRlKHRoaXMuX3dpbmR5LnJlZlRpbWUpO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIGFkZCB0aGUgZm9yZWNhc3QgdGltZSBhcyBob3VycyB0byB0aGUgcmVmVGltZTtcclxuICAgICAgICAgICAgICAgIGQuc2V0SG91cnMoZC5nZXRIb3VycygpICsgdGhpcy5fd2luZHkuZm9yZWNhc3RUaW1lKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuZGF0ZSA9IGQ7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuZGF0ZSA9IHVuZGVmaW5lZDtcclxuICAgIH1cclxufVxyXG5cclxuXHJcblxyXG4vKiAgR2xvYmFsIGNsYXNzIGZvciBzaW11bGF0aW5nIHRoZSBtb3ZlbWVudCBvZiBwYXJ0aWNsZSB0aHJvdWdoIGdyaWRcclxuIGNyZWRpdDogQWxsIHRoZSBjcmVkaXQgZm9yIHRoaXMgd29yayBnb2VzIHRvOiBodHRwczovL2dpdGh1Yi5jb20vY2FtYmVjYyBmb3IgY3JlYXRpbmcgdGhlIHJlcG86XHJcbiBodHRwczovL2dpdGh1Yi5jb20vY2FtYmVjYy9lYXJ0aC4gVGhlIG1ham9yaXR5IG9mIHRoaXMgY29kZSBpcyBkaXJlY3RseSB0YWtlbiBmcm9tIHRoZXJlLCBzaW5jZSBpdHMgYXdlc29tZS5cclxuIFRoaXMgY2xhc3MgdGFrZXMgYSBjYW52YXMgZWxlbWVudCBhbmQgYW4gYXJyYXkgb2YgZGF0YSAoMWttIEdGUyBmcm9tIGh0dHA6Ly93d3cuZW1jLm5jZXAubm9hYS5nb3YvaW5kZXgucGhwP2JyYW5jaD1HRlMpXHJcbiBhbmQgdGhlbiB1c2VzIGEgbWVyY2F0b3IgKGZvcndhcmQvcmV2ZXJzZSkgcHJvamVjdGlvbiB0byBjb3JyZWN0bHkgbWFwIHdpbmQgdmVjdG9ycyBpbiBcIm1hcCBzcGFjZVwiLlxyXG4gVGhlIFwic3RhcnRcIiBtZXRob2QgdGFrZXMgdGhlIGJvdW5kcyBvZiB0aGUgbWFwIGF0IGl0cyBjdXJyZW50IGV4dGVudCBhbmQgc3RhcnRzIHRoZSB3aG9sZSBncmlkZGluZyxcclxuIGludGVycG9sYXRpb24gYW5kIGFuaW1hdGlvbiBwcm9jZXNzLlxyXG4gRXh0cmEgY3JlZGl0IHRvIGh0dHBzOi8vZ2l0aHViLmNvbS9kYW53aWxkL2xlYWZsZXQtdmVsb2NpdHkgZm9yIG1vZGlmeWluZyB0aGUgY2xhc3MgdG8gYmUgbW9yZSBjdXN0b21pemFibGUgYW5kIHJldXNhYmxlIGZvciBvdGhlciBzY2VuYXJpb3MuXHJcbiBBbHNvIGNyZWRpdCB0byAtIGh0dHBzOi8vZ2l0aHViLmNvbS9Fc3JpL3dpbmQtanMgXHJcbiAqL1xyXG5jbGFzcyBXaW5keSB7XHJcblxyXG4gICAgTUlOX1ZFTE9DSVRZX0lOVEVOU0lUWTogbnVtYmVyO1xyXG4gICAgTUFYX1ZFTE9DSVRZX0lOVEVOU0lUWTogbnVtYmVyO1xyXG4gICAgVkVMT0NJVFlfU0NBTEU6IG51bWJlcjtcclxuICAgIE1BWF9QQVJUSUNMRV9BR0U6IG51bWJlcjtcclxuICAgIFBBUlRJQ0xFX0xJTkVfV0lEVEg6IG51bWJlcjtcclxuICAgIFBBUlRJQ0xFX01VTFRJUExJRVI6IG51bWJlcjtcclxuICAgIFBBUlRJQ0xFX1JFRFVDVElPTjogbnVtYmVyO1xyXG4gICAgRlJBTUVfUkFURTogbnVtYmVyO1xyXG4gICAgRlJBTUVfVElNRTogbnVtYmVyO1xyXG4gICAgY29sb3JTY2FsZTogYW55O1xyXG4gICAgY2FudmFzOiBIVE1MQ2FudmFzRWxlbWVudDtcclxuXHJcbiAgICBmb3JlY2FzdFRpbWU6IG51bWJlcjtcclxuICAgIHJlZlRpbWU6IHN0cmluZztcclxuXHJcbiAgICBOVUxMX1dJTkRfVkVDVE9SID0gW05hTiwgTmFOLCBudWxsXTsgLy8gc2luZ2xldG9uIGZvciBubyB3aW5kIGluIHRoZSBmb3JtOiBbdSwgdiwgbWFnbml0dWRlXVxyXG5cclxuICAgIHN0YXRpYyBmaWVsZDogYW55O1xyXG4gICAgc3RhdGljIGFuaW1hdGlvbkxvb3A7XHJcblxyXG4gICAgYnVpbGRlcjtcclxuICAgIGdyaWQ7XHJcbiAgICBncmlkRGF0YTogYW55O1xyXG4gICAgZGF0ZTtcclxuICAgIM67MDtcclxuICAgIM+GMDtcclxuICAgIM6Uzrs7XHJcbiAgICDOlM+GO1xyXG4gICAgbmk7XHJcbiAgICBuajtcclxuXHJcbiAgICBwcml2YXRlIF9zY2FuTW9kZTogbnVtYmVyO1xyXG4gICAgcHJpdmF0ZSBfZHluYW1pY1BhcnRpY2xlTXVsdGlwbGllcjogYm9vbGVhbjtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihjYW52YXM6IEhUTUxDYW52YXNFbGVtZW50LCBkYXRhPzogYW55LCBvcHRpb25zPzogRGlzcGxheU9wdGlvbnMpIHtcclxuXHJcbiAgICAgICAgdGhpcy5jYW52YXMgPSBjYW52YXM7XHJcbiAgICAgICAgaWYgKCFvcHRpb25zKSBvcHRpb25zID0ge307XHJcbiAgICAgICAgdGhpcy5zZXREaXNwbGF5T3B0aW9ucyhvcHRpb25zKTtcclxuICAgICAgICB0aGlzLmdyaWREYXRhID0gZGF0YTtcclxuXHJcbiAgICB9XHJcblxyXG4gICAgc2V0RGF0YShkYXRhKSB7XHJcbiAgICAgICAgdGhpcy5ncmlkRGF0YSA9IGRhdGE7XHJcbiAgICB9XHJcblxyXG4gICAgc2V0RGlzcGxheU9wdGlvbnMob3B0aW9uczogRGlzcGxheU9wdGlvbnMpIHtcclxuICAgICAgICB0aGlzLk1JTl9WRUxPQ0lUWV9JTlRFTlNJVFkgPSBvcHRpb25zLm1pblZlbG9jaXR5IHx8IDA7IC8vIHZlbG9jaXR5IGF0IHdoaWNoIHBhcnRpY2xlIGludGVuc2l0eSBpcyBtaW5pbXVtIChtL3MpXHJcbiAgICAgICAgdGhpcy5NQVhfVkVMT0NJVFlfSU5URU5TSVRZID0gb3B0aW9ucy5tYXhWZWxvY2l0eSB8fCAxMDsgLy8gdmVsb2NpdHkgYXQgd2hpY2ggcGFydGljbGUgaW50ZW5zaXR5IGlzIG1heGltdW0gKG0vcylcclxuICAgICAgICB0aGlzLlZFTE9DSVRZX1NDQUxFID0gKG9wdGlvbnMudmVsb2NpdHlTY2FsZSB8fCAwLjAwNSkgKiAoTWF0aC5wb3cod2luZG93LmRldmljZVBpeGVsUmF0aW8sIDEgLyAzKSB8fCAxKTsgLy8gc2NhbGUgZm9yIHdpbmQgdmVsb2NpdHkgKGNvbXBsZXRlbHkgYXJiaXRyYXJ5LS10aGlzIHZhbHVlIGxvb2tzIG5pY2UpXHJcbiAgICAgICAgdGhpcy5NQVhfUEFSVElDTEVfQUdFID0gb3B0aW9ucy5wYXJ0aWNsZUFnZSB8fCA5MDsgLy8gbWF4IG51bWJlciBvZiBmcmFtZXMgYSBwYXJ0aWNsZSBpcyBkcmF3biBiZWZvcmUgcmVnZW5lcmF0aW9uXHJcbiAgICAgICAgdGhpcy5QQVJUSUNMRV9MSU5FX1dJRFRIID0gb3B0aW9ucy5saW5lV2lkdGggfHwgMTsgLy8gbGluZSB3aWR0aCBvZiBhIGRyYXduIHBhcnRpY2xlXHJcblxyXG4gICAgICAgIC8vIGRlZmF1bHQgcGFydGljbGUgbXVsdGlwbGllciB0byAyXHJcbiAgICAgICAgdGhpcy5QQVJUSUNMRV9NVUxUSVBMSUVSID0gb3B0aW9ucy5wYXJ0aWNsZU11bHRpcGxpZXIgfHwgMjtcclxuXHJcbiAgICAgICAgdGhpcy5QQVJUSUNMRV9SRURVQ1RJT04gPSBNYXRoLnBvdyh3aW5kb3cuZGV2aWNlUGl4ZWxSYXRpbywgMSAvIDMpIHx8IDEuNjsgLy8gbXVsdGlwbHkgcGFydGljbGUgY291bnQgZm9yIG1vYmlsZXMgYnkgdGhpcyBhbW91bnRcclxuICAgICAgICB0aGlzLkZSQU1FX1JBVEUgPSBvcHRpb25zLmZyYW1lUmF0ZSB8fCAxNTtcclxuICAgICAgICB0aGlzLkZSQU1FX1RJTUUgPSAxMDAwIC8gdGhpcy5GUkFNRV9SQVRFOyAvLyBkZXNpcmVkIGZyYW1lcyBwZXIgc2Vjb25kXHJcblxyXG4gICAgICAgIHZhciBkZWZhdWx0Q29sb3JTY2FsZSA9IFtcInJnYig2MSwxNjAsMjQ3KVwiLCBcInJnYig5OSwxNjQsMjE3KVwiLCBcInJnYigxMzgsMTY4LDE4OClcIiwgXCJyZ2IoMTc3LDE3MywxNTgpXCIsIFwicmdiKDIxNiwxNzcsMTI5KVwiLCBcInJnYigyNTUsMTgyLDEwMClcIiwgXCJyZ2IoMjQwLDE0NSw4NylcIiwgXCJyZ2IoMjI1LDEwOSw3NClcIiwgXCJyZ2IoMjEwLDcyLDYxKVwiLCBcInJnYigxOTUsMzYsNDgpXCIsIFwicmdiKDE4MCwwLDM1KVwiXTtcclxuICAgICAgICB0aGlzLmNvbG9yU2NhbGUgPSBvcHRpb25zLmNvbG9yU2NhbGUgfHwgZGVmYXVsdENvbG9yU2NhbGU7XHJcbiAgICB9XHJcblxyXG4gICAgc3RhcnQoYm91bmRzLCB3aWR0aCwgaGVpZ2h0LCBleHRlbnQpIHtcclxuXHJcbiAgICAgICAgbGV0IG1hcEJvdW5kcyA9IHtcclxuICAgICAgICAgICAgc291dGg6IHRoaXMuZGVnMnJhZChleHRlbnRbMF1bMV0pLFxyXG4gICAgICAgICAgICBub3J0aDogdGhpcy5kZWcycmFkKGV4dGVudFsxXVsxXSksXHJcbiAgICAgICAgICAgIGVhc3Q6IHRoaXMuZGVnMnJhZChleHRlbnRbMV1bMF0pLFxyXG4gICAgICAgICAgICB3ZXN0OiB0aGlzLmRlZzJyYWQoZXh0ZW50WzBdWzBdKSxcclxuICAgICAgICAgICAgd2lkdGg6IHdpZHRoLFxyXG4gICAgICAgICAgICBoZWlnaHQ6IGhlaWdodFxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHRoaXMuc3RvcCgpO1xyXG5cclxuICAgICAgICAvLyBidWlsZCBncmlkXHJcbiAgICAgICAgdGhpcy5idWlsZEdyaWQodGhpcy5ncmlkRGF0YSwgKGdyaWRSZXN1bHQpID0+IHtcclxuICAgICAgICAgICAgbGV0IGJ1aWx0Qm91bmRzID0gdGhpcy5idWlsZEJvdW5kcyhib3VuZHMsIHdpZHRoLCBoZWlnaHQpO1xyXG4gICAgICAgICAgICB0aGlzLmludGVycG9sYXRlRmllbGQoZ3JpZFJlc3VsdCwgYnVpbHRCb3VuZHMsIG1hcEJvdW5kcywgKGJvdW5kcywgZmllbGQpID0+IHtcclxuICAgICAgICAgICAgICAgIC8vIGFuaW1hdGUgdGhlIGNhbnZhcyB3aXRoIHJhbmRvbSBwb2ludHNcclxuICAgICAgICAgICAgICAgIFdpbmR5LmZpZWxkID0gZmllbGQ7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFuaW1hdGUoYm91bmRzLCBXaW5keS5maWVsZCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIHN0b3AoKSB7XHJcbiAgICAgICAgaWYgKFdpbmR5LmZpZWxkKSBXaW5keS5maWVsZC5yZWxlYXNlKCk7XHJcbiAgICAgICAgaWYgKFdpbmR5LmFuaW1hdGlvbkxvb3ApIGNhbmNlbEFuaW1hdGlvbkZyYW1lKFdpbmR5LmFuaW1hdGlvbkxvb3ApO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgKiBHZXQgaW50ZXJwb2xhdGVkIGdyaWQgdmFsdWUgZnJvbSBMb24vTGF0IHBvc2l0aW9uXHJcbiAgICogQHBhcmFtIM67IHtGbG9hdH0gTG9uZ2l0dWRlXHJcbiAgICogQHBhcmFtIM+GIHtGbG9hdH0gTGF0aXR1ZGVcclxuICAgKiBAcmV0dXJucyB7T2JqZWN0fVxyXG4gICAqL1xyXG4gICAgaW50ZXJwb2xhdGUozrssIM+GKSB7XHJcblxyXG4gICAgICAgIGlmICghdGhpcy5ncmlkKSByZXR1cm4gbnVsbDtcclxuXHJcbiAgICAgICAgbGV0IGkgPSB0aGlzLmZsb29yTW9kKM67IC0gdGhpcy7OuzAsIDM2MCkgLyB0aGlzLs6Uzrs7IC8vIGNhbGN1bGF0ZSBsb25naXR1ZGUgaW5kZXggaW4gd3JhcHBlZCByYW5nZSBbMCwgMzYwKVxyXG4gICAgICAgIGxldCBqID0gKHRoaXMuz4YwIC0gz4YpIC8gdGhpcy7OlM+GOyAvLyBjYWxjdWxhdGUgbGF0aXR1ZGUgaW5kZXggaW4gZGlyZWN0aW9uICs5MCB0byAtOTBcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuX3NjYW5Nb2RlID09PSA2NCkge1xyXG4gICAgICAgICAgICAvLyBjYWxjdWxhdGUgbGF0aXR1ZGUgaW5kZXggaW4gZGlyZWN0aW9uIC05MCB0byArOTAgYXMgdGhpcyBpcyBzY2FuIG1vZGUgNjRcclxuICAgICAgICAgICAgaiA9ICjPhiAtIHRoaXMuz4YwKSAvIHRoaXMuzpTPhjtcclxuICAgICAgICAgICAgaiA9IHRoaXMuZ3JpZC5sZW5ndGggLSBqO1xyXG4gICAgICAgIH1cclxuXHJcblxyXG4gICAgICAgIGxldCBmaSA9IE1hdGguZmxvb3IoaSksXHJcbiAgICAgICAgICAgIGNpID0gZmkgKyAxO1xyXG4gICAgICAgIGxldCBmaiA9IE1hdGguZmxvb3IoaiksXHJcbiAgICAgICAgICAgIGNqID0gZmogKyAxO1xyXG5cclxuICAgICAgICBsZXQgcm93O1xyXG4gICAgICAgIGlmIChyb3cgPSB0aGlzLmdyaWRbZmpdKSB7XHJcbiAgICAgICAgICAgIHZhciBnMDAgPSByb3dbZmldO1xyXG4gICAgICAgICAgICB2YXIgZzEwID0gcm93W2NpXTtcclxuICAgICAgICAgICAgaWYgKHRoaXMuaXNWYWx1ZShnMDApICYmIHRoaXMuaXNWYWx1ZShnMTApICYmIChyb3cgPSB0aGlzLmdyaWRbY2pdKSkge1xyXG4gICAgICAgICAgICAgICAgdmFyIGcwMSA9IHJvd1tmaV07XHJcbiAgICAgICAgICAgICAgICB2YXIgZzExID0gcm93W2NpXTtcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmlzVmFsdWUoZzAxKSAmJiB0aGlzLmlzVmFsdWUoZzExKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIEFsbCBmb3VyIHBvaW50cyBmb3VuZCwgc28gaW50ZXJwb2xhdGUgdGhlIHZhbHVlLlxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmJ1aWxkZXIuaW50ZXJwb2xhdGUoaSAtIGZpLCBqIC0gZmosIGcwMCwgZzEwLCBnMDEsIGcxMSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBidWlsZEdyaWQoZGF0YSwgY2FsbGJhY2spIHtcclxuXHJcbiAgICAgICAgdGhpcy5idWlsZGVyID0gdGhpcy5jcmVhdGVCdWlsZGVyKGRhdGEpO1xyXG4gICAgICAgIHZhciBoZWFkZXIgPSB0aGlzLmJ1aWxkZXIuaGVhZGVyO1xyXG5cclxuICAgICAgICB0aGlzLs67MCA9IGhlYWRlci5sbzE7XHJcbiAgICAgICAgdGhpcy7PhjAgPSBoZWFkZXIubGExOyAvLyB0aGUgZ3JpZCdzIG9yaWdpbiAoZS5nLiwgMC4wRSwgOTAuME4pXHJcblxyXG4gICAgICAgIHRoaXMuzpTOuyA9IGhlYWRlci5keDtcclxuICAgICAgICB0aGlzLs6Uz4YgPSBoZWFkZXIuZHk7IC8vIGRpc3RhbmNlIGJldHdlZW4gZ3JpZCBwb2ludHMgKGUuZy4sIDIuNSBkZWcgbG9uLCAyLjUgZGVnIGxhdClcclxuXHJcbiAgICAgICAgdGhpcy5uaSA9IGhlYWRlci5ueDtcclxuICAgICAgICB0aGlzLm5qID0gaGVhZGVyLm55OyAvLyBudW1iZXIgb2YgZ3JpZCBwb2ludHMgVy1FIGFuZCBOLVMgKGUuZy4sIDE0NCB4IDczKVxyXG5cclxuICAgICAgICB0aGlzLmRhdGUgPSBuZXcgRGF0ZShoZWFkZXIucmVmVGltZSk7XHJcbiAgICAgICAgdGhpcy5kYXRlLnNldEhvdXJzKHRoaXMuZGF0ZS5nZXRIb3VycygpICsgaGVhZGVyLmZvcmVjYXN0VGltZSk7XHJcblxyXG4gICAgICAgIHRoaXMuX3NjYW5Nb2RlID0gaGVhZGVyLnNjYW5Nb2RlO1xyXG5cclxuICAgICAgICB0aGlzLmdyaWQgPSBbXTtcclxuICAgICAgICB2YXIgcCA9IDA7XHJcbiAgICAgICAgdmFyIGlzQ29udGludW91cyA9IE1hdGguZmxvb3IodGhpcy5uaSAqIHRoaXMuzpTOuykgPj0gMzYwO1xyXG5cclxuICAgICAgICBpZiAoaGVhZGVyLnNjYW5Nb2RlID09PSAwKSB7XHJcbiAgICAgICAgICAgIC8vIFNjYW4gbW9kZSAwLiBMb25naXR1ZGUgaW5jcmVhc2VzIGZyb20gzrswLCBhbmQgbGF0aXR1ZGUgZGVjcmVhc2VzIGZyb20gz4YwLlxyXG4gICAgICAgICAgICAvLyBodHRwOi8vd3d3Lm5jby5uY2VwLm5vYWEuZ292L3BtYi9kb2NzL2dyaWIyL2dyaWIyX3RhYmxlMy00LnNodG1sXHJcblxyXG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHRoaXMubmo7IGorKykge1xyXG4gICAgICAgICAgICAgICAgbGV0IHJvdyA9IFtdO1xyXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLm5pOyBpKysgLCBwKyspIHtcclxuICAgICAgICAgICAgICAgICAgICByb3dbaV0gPSB0aGlzLmJ1aWxkZXIuZGF0YShwKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGlmIChpc0NvbnRpbnVvdXMpIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBGb3Igd3JhcHBlZCBncmlkcywgZHVwbGljYXRlIGZpcnN0IGNvbHVtbiBhcyBsYXN0IGNvbHVtbiB0byBzaW1wbGlmeSBpbnRlcnBvbGF0aW9uIGxvZ2ljXHJcbiAgICAgICAgICAgICAgICAgICAgcm93LnB1c2gocm93WzBdKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHRoaXMuZ3JpZFtqXSA9IHJvdztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIGlmIChoZWFkZXIuc2Nhbk1vZGUgPT09IDY0KSB7XHJcbiAgICAgICAgICAgIC8vIFNjYW4gbW9kZSA2NC4gTG9uZ2l0dWRlIGluY3JlYXNlcyBmcm9tIM67MCwgYW5kIGxhdGl0dWRlIGluY3JlYXNlcyBmcm9tIM+GMC5cclxuICAgICAgICAgICAgZm9yIChsZXQgaiA9IHRoaXMubmogLSAxOyBqID49IDA7IGotLSkge1xyXG4gICAgICAgICAgICAgICAgbGV0IHJvdyA9IFtdO1xyXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLm5pOyBpKysgLCBwKyspIHtcclxuICAgICAgICAgICAgICAgICAgICByb3dbaV0gPSB0aGlzLmJ1aWxkZXIuZGF0YShwKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGlmIChpc0NvbnRpbnVvdXMpIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBGb3Igd3JhcHBlZCBncmlkcywgZHVwbGljYXRlIGZpcnN0IGNvbHVtbiBhcyBsYXN0IGNvbHVtbiB0byBzaW1wbGlmeSBpbnRlcnBvbGF0aW9uIGxvZ2ljXHJcbiAgICAgICAgICAgICAgICAgICAgcm93LnB1c2gocm93WzBdKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHRoaXMuZ3JpZFtqXSA9IHJvdztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY2FsbGJhY2soe1xyXG4gICAgICAgICAgICBkYXRlOiB0aGlzLmRhdGUsXHJcbiAgICAgICAgICAgIGludGVycG9sYXRlOiB0aGlzLmludGVycG9sYXRlXHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBjcmVhdGVCdWlsZGVyKGRhdGEpIHtcclxuICAgICAgICBsZXQgdUNvbXAgPSBudWxsLFxyXG4gICAgICAgICAgICB2Q29tcCA9IG51bGwsXHJcbiAgICAgICAgICAgIHNjYWxhciA9IG51bGwsXHJcbiAgICAgICAgICAgIGRpcmVjdGlvblRydWUgPSBudWxsLFxyXG4gICAgICAgICAgICBtYWduaXR1ZGUgPSBudWxsO1xyXG5cclxuICAgICAgICBsZXQgc3VwcG9ydGVkID0gdHJ1ZTtcclxuICAgICAgICBsZXQgaGVhZGVyRmllbGRzO1xyXG5cclxuICAgICAgICBkYXRhLmZvckVhY2goKHJlY29yZCkgPT4ge1xyXG4gICAgICAgICAgICBoZWFkZXJGaWVsZHMgPSBgJHtyZWNvcmQuaGVhZGVyLmRpc2NpcGxpbmV9LCR7cmVjb3JkLmhlYWRlci5wYXJhbWV0ZXJDYXRlZ29yeX0sJHtyZWNvcmQuaGVhZGVyLnBhcmFtZXRlck51bWJlcn1gO1xyXG4gICAgICAgICAgICBzd2l0Y2ggKGhlYWRlckZpZWxkcykge1xyXG4gICAgICAgICAgICAgICAgY2FzZSBcIjAsMSwyXCI6XHJcbiAgICAgICAgICAgICAgICBjYXNlIFwiMCwyLDJcIjpcclxuICAgICAgICAgICAgICAgICAgICB1Q29tcCA9IHJlY29yZDsgLy8gdGhpcyBpcyBtZXRlb3JvbG9naWNhbCBjb21wb25lbnQgd2l0aCB1IGFuZCB2LlxyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgY2FzZSBcIjAsMSwzXCI6XHJcbiAgICAgICAgICAgICAgICBjYXNlIFwiMCwyLDNcIjpcclxuICAgICAgICAgICAgICAgICAgICB2Q29tcCA9IHJlY29yZDsgLy8gdGhpcyBpcyBtZXRlb3JvbG9naWNhbCBjb21wb25lbnQgd2l0aCB1IGFuZCB2LlxyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgY2FzZSBcIjEwLDAsN1wiOlxyXG4gICAgICAgICAgICAgICAgY2FzZSBcIjEwLDAsMTBcIjpcclxuICAgICAgICAgICAgICAgIGNhc2UgXCIwLDIsMFwiOlxyXG4gICAgICAgICAgICAgICAgICAgIGRpcmVjdGlvblRydWUgPSByZWNvcmQ7IC8vd2F2ZXMgYW5kIHdpbmQgZGlyZWN0aW9uXHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICBjYXNlIFwiMTAsMCw4XCI6IFxyXG4gICAgICAgICAgICAgICAgY2FzZSBcIjEwLDAsM1wiOlxyXG4gICAgICAgICAgICAgICAgY2FzZSBcIjAsMiwxXCI6IFxyXG4gICAgICAgICAgICAgICAgICAgIG1hZ25pdHVkZSA9IHJlY29yZDsgLy93YXZlcyBhbmQgd2luZCBoZWlnaHRcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICAgICAgc3VwcG9ydGVkID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyBqdXN0IHRha2UgdGhlIGxhc3QgcmVjb3JkcyByZWZ0aW1lIGFuZCBmb3JlY2FzdCB0aW1lIGFzIHRoZSBvbmUgd2UncmUgdXNpbmdcclxuICAgICAgICAgICAgdGhpcy5yZWZUaW1lID0gcmVjb3JkLmhlYWRlci5yZWZUaW1lO1xyXG4gICAgICAgICAgICB0aGlzLmZvcmVjYXN0VGltZSA9IHJlY29yZC5oZWFkZXIuZm9yZWNhc3RUaW1lO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBpZiAoIXN1cHBvcnRlZCkge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiV2luZHkgZG9lc24ndCBzdXBwb3J0IGRpc2NpcGxpbmUsIGNhdGVnb3J5IGFuZCBudW1iZXIgY29tYmluYXRpb24uIFwiICsgaGVhZGVyRmllbGRzKTtcclxuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgICAgICB9XHJcblxyXG5cclxuICAgICAgICBpZiAoZGlyZWN0aW9uVHJ1ZSAmJiBtYWduaXR1ZGUpIHtcclxuICAgICAgICAgICAgLy8gSWYgZGF0YSBjb250YWlucyBhIGRpcmVjdGlvbiBhbmQgbWFnbml0dWRlIGNvbnZlcnQgaXQgdG8gYSB1IGFuZCB2LlxyXG4gICAgICAgICAgICB1Q29tcCA9IHt9O1xyXG4gICAgICAgICAgICB1Q29tcC5oZWFkZXIgPSBkaXJlY3Rpb25UcnVlLmhlYWRlcjtcclxuICAgICAgICAgICAgdkNvbXAgPSB7fTtcclxuICAgICAgICAgICAgdkNvbXAuaGVhZGVyID0gZGlyZWN0aW9uVHJ1ZS5oZWFkZXI7XHJcbiAgICAgICAgICAgIHVDb21wLmRhdGEgPSBbXTtcclxuICAgICAgICAgICAgdkNvbXAuZGF0YSA9IFtdO1xyXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gZGlyZWN0aW9uVHJ1ZS5kYXRhLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcblxyXG4gICAgICAgICAgICAgICAgbGV0IGRpciA9IGRpcmVjdGlvblRydWUuZGF0YVtpXTtcclxuICAgICAgICAgICAgICAgIGxldCBtYWcgPSBtYWduaXR1ZGUuZGF0YVtpXTtcclxuXHJcbiAgICAgICAgICAgICAgICBpZiAoKCFkaXIgfHwgaXNOYU4oZGlyKSkgfHwgKCFtYWcgfHwgaXNOYU4obWFnKSkpIHtcclxuICAgICAgICAgICAgICAgICAgICB2Q29tcFtpXSA9IG51bGw7XHJcbiAgICAgICAgICAgICAgICAgICAgdUNvbXBbaV0gPSBudWxsO1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIGxldCBwaGkgPSBkaXIgKiBNYXRoLlBJIC8gMTgwO1xyXG4gICAgICAgICAgICAgICAgbGV0IHUgPSAtbWFnICogTWF0aC5zaW4ocGhpKTtcclxuICAgICAgICAgICAgICAgIGxldCB2ID0gLW1hZyAqIE1hdGguY29zKHBoaSk7XHJcblxyXG4gICAgICAgICAgICAgICAgdUNvbXAuZGF0YVtpXSA9IHU7XHJcbiAgICAgICAgICAgICAgICB2Q29tcC5kYXRhW2ldID0gdjtcclxuXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG5cclxuICAgICAgICByZXR1cm4gdGhpcy5jcmVhdGVXaW5kQnVpbGRlcih1Q29tcCwgdkNvbXApO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgY3JlYXRlV2luZEJ1aWxkZXIodUNvbXAsIHZDb21wKSB7XHJcbiAgICAgICAgbGV0IHVEYXRhID0gdUNvbXAuZGF0YSxcclxuICAgICAgICAgICAgdkRhdGEgPSB2Q29tcC5kYXRhO1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIGhlYWRlcjogdUNvbXAuaGVhZGVyLFxyXG4gICAgICAgICAgICBkYXRhOiBmdW5jdGlvbiBkYXRhKGkpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBbdURhdGFbaV0sIHZEYXRhW2ldXTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgaW50ZXJwb2xhdGU6IHRoaXMuYmlsaW5lYXJJbnRlcnBvbGF0ZVZlY3RvclxyXG4gICAgICAgIH07XHJcbiAgICB9XHJcblxyXG5cclxuICAgIHByaXZhdGUgYnVpbGRCb3VuZHMoYm91bmRzLCB3aWR0aCwgaGVpZ2h0KSB7XHJcbiAgICAgICAgbGV0IHVwcGVyTGVmdCA9IGJvdW5kc1swXTtcclxuICAgICAgICBsZXQgbG93ZXJSaWdodCA9IGJvdW5kc1sxXTtcclxuICAgICAgICBsZXQgeCA9IE1hdGgucm91bmQodXBwZXJMZWZ0WzBdKTtcclxuICAgICAgICBsZXQgeSA9IE1hdGgubWF4KE1hdGguZmxvb3IodXBwZXJMZWZ0WzFdKSwgMCk7XHJcbiAgICAgICAgbGV0IHhNYXggPSBNYXRoLm1pbihNYXRoLmNlaWwobG93ZXJSaWdodFswXSksIHdpZHRoIC0gMSk7XHJcbiAgICAgICAgbGV0IHlNYXggPSBNYXRoLm1pbihNYXRoLmNlaWwobG93ZXJSaWdodFsxXSksIGhlaWdodCAtIDEpO1xyXG4gICAgICAgIHJldHVybiB7IHg6IHgsIHk6IHksIHhNYXg6IHdpZHRoLCB5TWF4OiB5TWF4LCB3aWR0aDogd2lkdGgsIGhlaWdodDogaGVpZ2h0IH07XHJcbiAgICB9XHJcblxyXG5cclxuICAgIC8vIGludGVycG9sYXRpb24gZm9yIHZlY3RvcnMgbGlrZSB3aW5kICh1LHYsbSlcclxuICAgIHByaXZhdGUgYmlsaW5lYXJJbnRlcnBvbGF0ZVZlY3Rvcih4LCB5LCBnMDAsIGcxMCwgZzAxLCBnMTEpIHtcclxuICAgICAgICBsZXQgcnggPSAxIC0geDtcclxuICAgICAgICBsZXQgcnkgPSAxIC0geTtcclxuICAgICAgICBsZXQgYSA9IHJ4ICogcnksXHJcbiAgICAgICAgICAgIGIgPSB4ICogcnksXHJcbiAgICAgICAgICAgIGMgPSByeCAqIHksXHJcbiAgICAgICAgICAgIGQgPSB4ICogeTtcclxuICAgICAgICBsZXQgdSA9IGcwMFswXSAqIGEgKyBnMTBbMF0gKiBiICsgZzAxWzBdICogYyArIGcxMVswXSAqIGQ7XHJcbiAgICAgICAgbGV0IHYgPSBnMDBbMV0gKiBhICsgZzEwWzFdICogYiArIGcwMVsxXSAqIGMgKyBnMTFbMV0gKiBkO1xyXG4gICAgICAgIHJldHVybiBbdSwgdiwgTWF0aC5zcXJ0KHUgKiB1ICsgdiAqIHYpXTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGRlZzJyYWQoZGVnKSB7XHJcbiAgICAgICAgcmV0dXJuIGRlZyAvIDE4MCAqIE1hdGguUEk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSByYWQyZGVnKGFuZykge1xyXG4gICAgICAgIHJldHVybiBhbmcgLyAoTWF0aC5QSSAvIDE4MC4wKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICogQHJldHVybnMge0Jvb2xlYW59IHRydWUgaWYgdGhlIHNwZWNpZmllZCB2YWx1ZSBpcyBub3QgbnVsbCBhbmQgbm90IHVuZGVmaW5lZC5cclxuICAgICovXHJcbiAgICBwcml2YXRlIGlzVmFsdWUoeCkge1xyXG4gICAgICAgIHJldHVybiB4ICE9PSBudWxsICYmIHggIT09IHVuZGVmaW5lZDtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICogQHJldHVybnMge051bWJlcn0gcmV0dXJucyByZW1haW5kZXIgb2YgZmxvb3JlZCBkaXZpc2lvbiwgaS5lLiwgZmxvb3IoYSAvIG4pLiBVc2VmdWwgZm9yIGNvbnNpc3RlbnQgbW9kdWxvXHJcbiAgICAqICAgICAgICAgIG9mIG5lZ2F0aXZlIG51bWJlcnMuIFNlZSBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL01vZHVsb19vcGVyYXRpb24uXHJcbiAgICAqL1xyXG4gICAgcHJpdmF0ZSBmbG9vck1vZChhLCBuKSB7XHJcbiAgICAgICAgcmV0dXJuIGEgLSBuICogTWF0aC5mbG9vcihhIC8gbik7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAqIEByZXR1cm5zIHtOdW1iZXJ9IHRoZSB2YWx1ZSB4IGNsYW1wZWQgdG8gdGhlIHJhbmdlIFtsb3csIGhpZ2hdLlxyXG4gICAgKi9cclxuICAgIHByaXZhdGUgY2xhbXAoeCwgcmFuZ2UpIHtcclxuICAgICAgICByZXR1cm4gTWF0aC5tYXgocmFuZ2VbMF0sIE1hdGgubWluKHgsIHJhbmdlWzFdKSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAqIEByZXR1cm5zIHtCb29sZWFufSB0cnVlIGlmIGFnZW50IGlzIHByb2JhYmx5IGEgbW9iaWxlIGRldmljZS4gRG9uJ3QgcmVhbGx5IGNhcmUgaWYgdGhpcyBpcyBhY2N1cmF0ZS5cclxuICAgICovXHJcbiAgICBwcml2YXRlIGlzTW9iaWxlKCkge1xyXG4gICAgICAgIHJldHVybiAoL2FuZHJvaWR8YmxhY2tiZXJyeXxpZW1vYmlsZXxpcGFkfGlwaG9uZXxpcG9kfG9wZXJhIG1pbml8d2Vib3MvaS50ZXN0KG5hdmlnYXRvci51c2VyQWdlbnQpKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICogQ2FsY3VsYXRlIGRpc3RvcnRpb24gb2YgdGhlIHdpbmQgdmVjdG9yIGNhdXNlZCBieSB0aGUgc2hhcGUgb2YgdGhlIHByb2plY3Rpb24gYXQgcG9pbnQgKHgsIHkpLiBUaGUgd2luZFxyXG4gICAgKiB2ZWN0b3IgaXMgbW9kaWZpZWQgaW4gcGxhY2UgYW5kIHJldHVybmVkIGJ5IHRoaXMgZnVuY3Rpb24uXHJcbiAgICAqL1xyXG4gICAgcHJpdmF0ZSBkaXN0b3J0KHByb2plY3Rpb24sIM67LCDPhiwgeCwgeSwgc2NhbGUsIHdpbmQsIHdpbmR5KSB7XHJcbiAgICAgICAgdmFyIHUgPSB3aW5kWzBdICogc2NhbGU7XHJcbiAgICAgICAgdmFyIHYgPSB3aW5kWzFdICogc2NhbGU7XHJcbiAgICAgICAgdmFyIGQgPSB0aGlzLmRpc3RvcnRpb24ocHJvamVjdGlvbiwgzrssIM+GLCB4LCB5LCB3aW5keSk7XHJcblxyXG4gICAgICAgIC8vIFNjYWxlIGRpc3RvcnRpb24gdmVjdG9ycyBieSB1IGFuZCB2LCB0aGVuIGFkZC5cclxuICAgICAgICB3aW5kWzBdID0gZFswXSAqIHUgKyBkWzJdICogdjtcclxuICAgICAgICB3aW5kWzFdID0gZFsxXSAqIHUgKyBkWzNdICogdjtcclxuICAgICAgICByZXR1cm4gd2luZDtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGRpc3RvcnRpb24ocHJvamVjdGlvbiwgzrssIM+GLCB4LCB5LCB3aW5keSkge1xyXG4gICAgICAgIGxldCDPhCA9IDIgKiBNYXRoLlBJO1xyXG4gICAgICAgIGxldCBIID0gTWF0aC5wb3coMTAsIC01LjIpO1xyXG4gICAgICAgIGxldCBozrsgPSDOuyA8IDAgPyBIIDogLUg7XHJcbiAgICAgICAgbGV0IGjPhiA9IM+GIDwgMCA/IEggOiAtSDtcclxuXHJcbiAgICAgICAgbGV0IHDOuyA9IHRoaXMucHJvamVjdCjPhiwgzrsgKyBozrssIHdpbmR5KTtcclxuICAgICAgICBsZXQgcM+GID0gdGhpcy5wcm9qZWN0KM+GICsgaM+GLCDOuywgd2luZHkpO1xyXG5cclxuICAgICAgICAvLyBNZXJpZGlhbiBzY2FsZSBmYWN0b3IgKHNlZSBTbnlkZXIsIGVxdWF0aW9uIDQtMyksIHdoZXJlIFIgPSAxLiBUaGlzIGhhbmRsZXMgaXNzdWUgd2hlcmUgbGVuZ3RoIG9mIDHCuiDOu1xyXG4gICAgICAgIC8vIGNoYW5nZXMgZGVwZW5kaW5nIG9uIM+GLiBXaXRob3V0IHRoaXMsIHRoZXJlIGlzIGEgcGluY2hpbmcgZWZmZWN0IGF0IHRoZSBwb2xlcy5cclxuICAgICAgICBsZXQgayA9IE1hdGguY29zKM+GIC8gMzYwICogz4QpO1xyXG4gICAgICAgIHJldHVybiBbKHDOu1swXSAtIHgpIC8gaM67IC8gaywgKHDOu1sxXSAtIHkpIC8gaM67IC8gaywgKHDPhlswXSAtIHgpIC8gaM+GLCAocM+GWzFdIC0geSkgLyBoz4ZdO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgbWVyY1kobGF0KSB7XHJcbiAgICAgICAgcmV0dXJuIE1hdGgubG9nKE1hdGgudGFuKGxhdCAvIDIgKyBNYXRoLlBJIC8gNCkpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgcHJvamVjdChsYXQsIGxvbiwgd2luZHkpIHtcclxuICAgICAgICAvLyBib3RoIGluIHJhZGlhbnMsIHVzZSBkZWcycmFkIGlmIG5lY2Nlc3NhcnlcclxuICAgICAgICBsZXQgeW1pbiA9IHRoaXMubWVyY1kod2luZHkuc291dGgpO1xyXG4gICAgICAgIGxldCB5bWF4ID0gdGhpcy5tZXJjWSh3aW5keS5ub3J0aCk7XHJcbiAgICAgICAgbGV0IHhGYWN0b3IgPSB3aW5keS53aWR0aCAvICh3aW5keS5lYXN0IC0gd2luZHkud2VzdCk7XHJcbiAgICAgICAgbGV0IHlGYWN0b3IgPSB3aW5keS5oZWlnaHQgLyAoeW1heCAtIHltaW4pO1xyXG5cclxuICAgICAgICBsZXQgeSA9IHRoaXMubWVyY1kodGhpcy5kZWcycmFkKGxhdCkpO1xyXG4gICAgICAgIGxldCB4ID0gKHRoaXMuZGVnMnJhZChsb24pIC0gd2luZHkud2VzdCkgKiB4RmFjdG9yO1xyXG4gICAgICAgIHkgPSAoeW1heCAtIHkpICogeUZhY3RvcjsgLy8geSBwb2ludHMgc291dGhcclxuICAgICAgICByZXR1cm4gW3gsIHldO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgaW52ZXJ0KHgsIHksIHdpbmR5KSB7XHJcbiAgICAgICAgbGV0IG1hcExvbkRlbHRhID0gd2luZHkuZWFzdCAtIHdpbmR5Lndlc3Q7XHJcbiAgICAgICAgbGV0IHdvcmxkTWFwUmFkaXVzID0gd2luZHkud2lkdGggLyB0aGlzLnJhZDJkZWcobWFwTG9uRGVsdGEpICogMzYwIC8gKDIgKiBNYXRoLlBJKTtcclxuICAgICAgICBsZXQgbWFwT2Zmc2V0WSA9IHdvcmxkTWFwUmFkaXVzIC8gMiAqIE1hdGgubG9nKCgxICsgTWF0aC5zaW4od2luZHkuc291dGgpKSAvICgxIC0gTWF0aC5zaW4od2luZHkuc291dGgpKSk7XHJcbiAgICAgICAgbGV0IGVxdWF0b3JZID0gd2luZHkuaGVpZ2h0ICsgbWFwT2Zmc2V0WTtcclxuICAgICAgICBsZXQgYSA9IChlcXVhdG9yWSAtIHkpIC8gd29ybGRNYXBSYWRpdXM7XHJcblxyXG4gICAgICAgIGxldCBsYXQgPSAxODAgLyBNYXRoLlBJICogKDIgKiBNYXRoLmF0YW4oTWF0aC5leHAoYSkpIC0gTWF0aC5QSSAvIDIpO1xyXG4gICAgICAgIGxldCBsb24gPSB0aGlzLnJhZDJkZWcod2luZHkud2VzdCkgKyB4IC8gd2luZHkud2lkdGggKiB0aGlzLnJhZDJkZWcobWFwTG9uRGVsdGEpO1xyXG4gICAgICAgIHJldHVybiBbbG9uLCBsYXRdO1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICBwcml2YXRlIGludGVycG9sYXRlRmllbGQoZ3JpZCwgYm91bmRzLCBleHRlbnQsIGNhbGxiYWNrKSB7XHJcblxyXG4gICAgICAgIGxldCBwcm9qZWN0aW9uID0ge307XHJcbiAgICAgICAgbGV0IG1hcEFyZWEgPSAoZXh0ZW50LnNvdXRoIC0gZXh0ZW50Lm5vcnRoKSAqIChleHRlbnQud2VzdCAtIGV4dGVudC5lYXN0KTtcclxuICAgICAgICBsZXQgdmVsb2NpdHlTY2FsZSA9IHRoaXMuVkVMT0NJVFlfU0NBTEUgKiBNYXRoLnBvdyhtYXBBcmVhLCAwLjQpO1xyXG5cclxuICAgICAgICBsZXQgY29sdW1ucyA9IFtdO1xyXG4gICAgICAgIGxldCB4ID0gYm91bmRzLng7XHJcblxyXG4gICAgICAgIGxldCBpbnRlcnBvbGF0ZUNvbHVtbiA9ICh4KSA9PiB7XHJcbiAgICAgICAgICAgIGxldCBjb2x1bW4gPSBbXTtcclxuICAgICAgICAgICAgZm9yIChsZXQgeSA9IGJvdW5kcy55OyB5IDw9IGJvdW5kcy55TWF4OyB5ICs9IDIpIHtcclxuICAgICAgICAgICAgICAgIGxldCBjb29yZCA9IHRoaXMuaW52ZXJ0KHgsIHksIGV4dGVudCk7XHJcbiAgICAgICAgICAgICAgICBpZiAoY29vcmQpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgzrsgPSBjb29yZFswXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgz4YgPSBjb29yZFsxXTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoaXNGaW5pdGUozrspKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vbGV0IHdpbmQgPSBncmlkLmludGVycG9sYXRlKM67LCDPhik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCB3aW5kID0gdGhpcy5pbnRlcnBvbGF0ZSjOuywgz4YpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAod2luZCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgd2luZCA9IHRoaXMuZGlzdG9ydChwcm9qZWN0aW9uLCDOuywgz4YsIHgsIHksIHZlbG9jaXR5U2NhbGUsIHdpbmQsIGV4dGVudCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2x1bW5beSArIDFdID0gY29sdW1uW3ldID0gd2luZDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBjb2x1bW5zW3ggKyAxXSA9IGNvbHVtbnNbeF0gPSBjb2x1bW47XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgbGV0IGJhdGNoSW50ZXJwb2xhdGUgPSAoKSA9PiB7XHJcbiAgICAgICAgICAgIGxldCBzdGFydCA9IERhdGUubm93KCk7XHJcbiAgICAgICAgICAgIHdoaWxlICh4IDwgYm91bmRzLndpZHRoKSB7XHJcbiAgICAgICAgICAgICAgICBpbnRlcnBvbGF0ZUNvbHVtbih4KTtcclxuICAgICAgICAgICAgICAgIHggKz0gMjtcclxuICAgICAgICAgICAgICAgIGlmIChEYXRlLm5vdygpIC0gc3RhcnQgPiAxMDAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy9NQVhfVEFTS19USU1FKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiBiYXRjaEludGVycG9sYXRlLCAyNSk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHRoaXMuY3JlYXRlRmllbGQoY29sdW1ucywgYm91bmRzLCBjYWxsYmFjayk7XHJcbiAgICAgICAgfTtcclxuICAgICAgICBiYXRjaEludGVycG9sYXRlKCk7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIHByaXZhdGUgY3JlYXRlRmllbGQoY29sdW1ucywgYm91bmRzLCBjYWxsYmFjaykge1xyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAqIEByZXR1cm5zIHtBcnJheX0gd2luZCB2ZWN0b3IgW3UsIHYsIG1hZ25pdHVkZV0gYXQgdGhlIHBvaW50ICh4LCB5KSwgb3IgW05hTiwgTmFOLCBudWxsXSBpZiB3aW5kXHJcbiAgICAgICAgKiAgICAgICAgICBpcyB1bmRlZmluZWQgYXQgdGhhdCBwb2ludC5cclxuICAgICAgICAqL1xyXG4gICAgICAgIGxldCBmaWVsZDogYW55ID0gKHgsIHkpID0+IHtcclxuICAgICAgICAgICAgdmFyIGNvbHVtbiA9IGNvbHVtbnNbTWF0aC5yb3VuZCh4KV07XHJcbiAgICAgICAgICAgIHJldHVybiBjb2x1bW4gJiYgY29sdW1uW01hdGgucm91bmQoeSldIHx8IHRoaXMuTlVMTF9XSU5EX1ZFQ1RPUjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIEZyZWVzIHRoZSBtYXNzaXZlIFwiY29sdW1uc1wiIGFycmF5IGZvciBHQy4gV2l0aG91dCB0aGlzLCB0aGUgYXJyYXkgaXMgbGVha2VkIChpbiBDaHJvbWUpIGVhY2ggdGltZSBhIG5ld1xyXG4gICAgICAgIC8vIGZpZWxkIGlzIGludGVycG9sYXRlZCBiZWNhdXNlIHRoZSBmaWVsZCBjbG9zdXJlJ3MgY29udGV4dCBpcyBsZWFrZWQsIGZvciByZWFzb25zIHRoYXQgZGVmeSBleHBsYW5hdGlvbi5cclxuICAgICAgICBmaWVsZC5yZWxlYXNlID0gKCkgPT4ge1xyXG4gICAgICAgICAgICBjb2x1bW5zID0gW107XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgZmllbGQucmFuZG9taXplID0gKG8pID0+IHtcclxuICAgICAgICAgICAgLy8gVU5ET05FOiB0aGlzIG1ldGhvZCBpcyB0ZXJyaWJsZVxyXG4gICAgICAgICAgICB2YXIgeCwgeTtcclxuICAgICAgICAgICAgdmFyIHNhZmV0eU5ldCA9IDA7XHJcbiAgICAgICAgICAgIGRvIHtcclxuICAgICAgICAgICAgICAgIHggPSBNYXRoLnJvdW5kKE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIGJvdW5kcy53aWR0aCkgKyBib3VuZHMueCk7XHJcbiAgICAgICAgICAgICAgICB5ID0gTWF0aC5yb3VuZChNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBib3VuZHMuaGVpZ2h0KSArIGJvdW5kcy55KTtcclxuICAgICAgICAgICAgfSB3aGlsZSAoZmllbGQoeCwgeSlbMl0gPT09IG51bGwgJiYgc2FmZXR5TmV0KysgPCAzMCk7XHJcbiAgICAgICAgICAgIG8ueCA9IHg7XHJcbiAgICAgICAgICAgIG8ueSA9IHk7XHJcbiAgICAgICAgICAgIHJldHVybiBvO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGNhbGxiYWNrKGJvdW5kcywgZmllbGQpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYW5pbWF0ZShib3VuZHMsIGZpZWxkKSB7XHJcblxyXG4gICAgICAgIGxldCB3aW5kSW50ZW5zaXR5Q29sb3JTY2FsZSA9IChtaW4sIG1heCkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLmNvbG9yU2NhbGUuaW5kZXhGb3IgPSAobSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgLy8gbWFwIHZlbG9jaXR5IHNwZWVkIHRvIGEgc3R5bGVcclxuICAgICAgICAgICAgICAgIHJldHVybiBNYXRoLm1heCgwLCBNYXRoLm1pbih0aGlzLmNvbG9yU2NhbGUubGVuZ3RoIC0gMSwgTWF0aC5yb3VuZCgobSAtIG1pbikgLyAobWF4IC0gbWluKSAqICh0aGlzLmNvbG9yU2NhbGUubGVuZ3RoIC0gMSkpKSk7XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNvbG9yU2NhbGU7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgY29sb3JTdHlsZXMgPSB3aW5kSW50ZW5zaXR5Q29sb3JTY2FsZSh0aGlzLk1JTl9WRUxPQ0lUWV9JTlRFTlNJVFksIHRoaXMuTUFYX1ZFTE9DSVRZX0lOVEVOU0lUWSk7XHJcbiAgICAgICAgbGV0IGJ1Y2tldHMgPSBjb2xvclN0eWxlcy5tYXAoZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gW107XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGxldCBwYXJ0aWNsZUNvdW50ID0gTWF0aC5yb3VuZChib3VuZHMud2lkdGggKiBib3VuZHMuaGVpZ2h0ICogdGhpcy5QQVJUSUNMRV9NVUxUSVBMSUVSIC8gMTAwMCk7XHJcbiAgICAgICAgaWYgKHRoaXMuaXNNb2JpbGUoKSkge1xyXG4gICAgICAgICAgICBwYXJ0aWNsZUNvdW50ICo9IHRoaXMuUEFSVElDTEVfUkVEVUNUSU9OO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IGZhZGVGaWxsU3R5bGUgPSBcInJnYmEoMCwgMCwgMCwgMC45NylcIjtcclxuXHJcbiAgICAgICAgbGV0IHBhcnRpY2xlcyA9IFtdO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcGFydGljbGVDb3VudDsgaSsrKSB7XHJcbiAgICAgICAgICAgIHBhcnRpY2xlcy5wdXNoKGZpZWxkLnJhbmRvbWl6ZSh7IGFnZTogTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogdGhpcy5NQVhfUEFSVElDTEVfQUdFKSArIDAgfSkpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IGV2b2x2ZSA9ICgpID0+IHtcclxuICAgICAgICAgICAgYnVja2V0cy5mb3JFYWNoKChidWNrZXQpID0+IHtcclxuICAgICAgICAgICAgICAgIGJ1Y2tldC5sZW5ndGggPSAwO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgcGFydGljbGVzLmZvckVhY2goKHBhcnRpY2xlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZiAocGFydGljbGUuYWdlID4gdGhpcy5NQVhfUEFSVElDTEVfQUdFKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZmllbGQucmFuZG9taXplKHBhcnRpY2xlKS5hZ2UgPSAwO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgdmFyIHggPSBwYXJ0aWNsZS54O1xyXG4gICAgICAgICAgICAgICAgdmFyIHkgPSBwYXJ0aWNsZS55O1xyXG4gICAgICAgICAgICAgICAgdmFyIHYgPSBmaWVsZCh4LCB5KTsgLy8gdmVjdG9yIGF0IGN1cnJlbnQgcG9zaXRpb25cclxuICAgICAgICAgICAgICAgIHZhciBtID0gdlsyXTtcclxuICAgICAgICAgICAgICAgIGlmIChtID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcGFydGljbGUuYWdlID0gdGhpcy5NQVhfUEFSVElDTEVfQUdFOyAvLyBwYXJ0aWNsZSBoYXMgZXNjYXBlZCB0aGUgZ3JpZCwgbmV2ZXIgdG8gcmV0dXJuLi4uXHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciB4dCA9IHggKyB2WzBdO1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciB5dCA9IHkgKyB2WzFdO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChmaWVsZCh4dCwgeXQpWzJdICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFBhdGggZnJvbSAoeCx5KSB0byAoeHQseXQpIGlzIHZpc2libGUsIHNvIGFkZCB0aGlzIHBhcnRpY2xlIHRvIHRoZSBhcHByb3ByaWF0ZSBkcmF3IGJ1Y2tldC5cclxuICAgICAgICAgICAgICAgICAgICAgICAgcGFydGljbGUueHQgPSB4dDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcGFydGljbGUueXQgPSB5dDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYnVja2V0c1tjb2xvclN0eWxlcy5pbmRleEZvcihtKV0ucHVzaChwYXJ0aWNsZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gUGFydGljbGUgaXNuJ3QgdmlzaWJsZSwgYnV0IGl0IHN0aWxsIG1vdmVzIHRocm91Z2ggdGhlIGZpZWxkLlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJ0aWNsZS54ID0geHQ7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcnRpY2xlLnkgPSB5dDtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBwYXJ0aWNsZS5hZ2UgKz0gMTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgZyA9IHRoaXMuY2FudmFzLmdldENvbnRleHQoXCIyZFwiKTtcclxuICAgICAgICBnLmxpbmVXaWR0aCA9IHRoaXMuUEFSVElDTEVfTElORV9XSURUSDtcclxuICAgICAgICBnLmZpbGxTdHlsZSA9IGZhZGVGaWxsU3R5bGU7XHJcbiAgICAgICAgZy5nbG9iYWxBbHBoYSA9IDAuNjtcclxuXHJcbiAgICAgICAgbGV0IGRyYXcgPSAoKSA9PiB7XHJcbiAgICAgICAgICAgIC8vIEZhZGUgZXhpc3RpbmcgcGFydGljbGUgdHJhaWxzLlxyXG4gICAgICAgICAgICBsZXQgcHJldiA9IFwibGlnaHRlclwiO1xyXG4gICAgICAgICAgICBnLmdsb2JhbENvbXBvc2l0ZU9wZXJhdGlvbiA9IFwiZGVzdGluYXRpb24taW5cIjtcclxuICAgICAgICAgICAgZy5maWxsUmVjdChib3VuZHMueCwgYm91bmRzLnksIGJvdW5kcy53aWR0aCwgYm91bmRzLmhlaWdodCk7XHJcbiAgICAgICAgICAgIGcuZ2xvYmFsQ29tcG9zaXRlT3BlcmF0aW9uID0gcHJldjtcclxuICAgICAgICAgICAgZy5nbG9iYWxBbHBoYSA9IDAuOTtcclxuXHJcbiAgICAgICAgICAgIC8vIERyYXcgbmV3IHBhcnRpY2xlIHRyYWlscy5cclxuICAgICAgICAgICAgYnVja2V0cy5mb3JFYWNoKChidWNrZXQsIGkpID0+IHtcclxuICAgICAgICAgICAgICAgIGlmIChidWNrZXQubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGcuYmVnaW5QYXRoKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgZy5zdHJva2VTdHlsZSA9IGNvbG9yU3R5bGVzW2ldO1xyXG4gICAgICAgICAgICAgICAgICAgIGJ1Y2tldC5mb3JFYWNoKChwYXJ0aWNsZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBnLm1vdmVUbyhwYXJ0aWNsZS54LCBwYXJ0aWNsZS55KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZy5saW5lVG8ocGFydGljbGUueHQsIHBhcnRpY2xlLnl0KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcGFydGljbGUueCA9IHBhcnRpY2xlLnh0O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJ0aWNsZS55ID0gcGFydGljbGUueXQ7XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgZy5zdHJva2UoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgdGhlbiA9IERhdGUubm93KCk7XHJcbiAgICAgICAgbGV0IGZyYW1lID0gKCkgPT4ge1xyXG4gICAgICAgICAgICBXaW5keS5hbmltYXRpb25Mb29wID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKGZyYW1lKTtcclxuICAgICAgICAgICAgdmFyIG5vdyA9IERhdGUubm93KCk7XHJcbiAgICAgICAgICAgIHZhciBkZWx0YSA9IG5vdyAtIHRoZW47XHJcbiAgICAgICAgICAgIGlmIChkZWx0YSA+IHRoaXMuRlJBTUVfVElNRSkge1xyXG4gICAgICAgICAgICAgICAgdGhlbiA9IG5vdyAtIGRlbHRhICUgdGhpcy5GUkFNRV9USU1FO1xyXG4gICAgICAgICAgICAgICAgZXZvbHZlKCk7XHJcbiAgICAgICAgICAgICAgICBkcmF3KCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9O1xyXG4gICAgICAgIGZyYW1lKCk7XHJcbiAgICB9XHJcbn1cclxuXHJcbmlmICghd2luZG93LmNhbmNlbEFuaW1hdGlvbkZyYW1lKSB7XHJcbiAgICB3aW5kb3cuY2FuY2VsQW5pbWF0aW9uRnJhbWUgPSAoaWQpID0+IHtcclxuICAgICAgICBjbGVhclRpbWVvdXQoaWQpO1xyXG4gICAgfTtcclxufSJdfQ==
