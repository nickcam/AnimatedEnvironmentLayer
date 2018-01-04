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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3R5cGVzY3JpcHQvYW5pbWF0ZWRFbnZpcm9ubWVudExheWVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDJFQUEyRTtBQUMzRSx3QkFBd0I7QUFDeEIsRUFBRTtBQUNGLGtDQUFrQztBQUNsQyxFQUFFO0FBQ0Ysc0RBQXNEO0FBQ3RELEVBQUU7QUFDRiwyRUFBMkU7QUFDM0UsOEVBQThFO0FBQzlFLDZFQUE2RTtBQUM3RSw0RUFBNEU7QUFDNUUseUVBQXlFO0FBQ3pFLHVFQUF1RTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7SUFvRnZFO1FBQThDLDRDQUEyQjtRQW1DckUsa0NBQVksVUFBOEM7WUFBMUQsWUFDSSxrQkFBTSxVQUFVLENBQUMsU0FtQnBCO1lBNUJPLG9CQUFjLEdBQVcsQ0FBQyxDQUFDO1lBRTNCLGdCQUFVLEdBQVksS0FBSyxDQUFDO1lBU2hDLDZEQUE2RDtZQUM3RCxLQUFJLENBQUMsV0FBVyxHQUFHLFVBQVUsQ0FBQyxVQUFVLENBQUM7WUFDekMsS0FBSSxDQUFDLEdBQUcsR0FBRyxVQUFVLENBQUMsR0FBRyxDQUFDO1lBQzFCLEtBQUksQ0FBQyxjQUFjLEdBQUcsVUFBVSxDQUFDLGNBQWMsSUFBSSxFQUFFLENBQUM7WUFDdEQsS0FBSSxDQUFDLFlBQVksR0FBRyxVQUFVLENBQUMsWUFBWSxLQUFLLEtBQUssR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDLENBQUMsa0JBQWtCO1lBRXhGLEtBQUksQ0FBQyxFQUFFLENBQUMsa0JBQWtCLEVBQUUsVUFBQyxHQUFHLElBQUssT0FBQSxLQUFJLENBQUMsaUJBQWlCLENBQUMsR0FBRyxDQUFDLEVBQTNCLENBQTJCLENBQUMsQ0FBQztZQUVsRSwyREFBMkQ7WUFDM0QsVUFBVSxDQUFDLEtBQUssQ0FBQyxLQUFJLEVBQUUsS0FBSyxFQUFFLFVBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxJQUFLLE9BQUEsS0FBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBNUIsQ0FBNEIsQ0FBQyxDQUFDO1lBRTVFLDJEQUEyRDtZQUMzRCxVQUFVLENBQUMsS0FBSyxDQUFDLEtBQUksRUFBRSxTQUFTLEVBQUUsVUFBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUssT0FBQSxLQUFJLENBQUMsZUFBZSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFoQyxDQUFnQyxDQUFDLENBQUM7WUFFcEYsbURBQW1EO1lBQ25ELFVBQVUsQ0FBQyxLQUFLLENBQUMsS0FBSSxFQUFFLGdCQUFnQixFQUFFLFVBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxJQUFLLE9BQUEsS0FBSSxDQUFDLHNCQUFzQixDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUF2QyxDQUF1QyxDQUFDLENBQUM7WUFDbEcsS0FBSSxDQUFDLGtCQUFrQixHQUFHLElBQUksQ0FBQzs7UUFDbkMsQ0FBQztRQUVEOztXQUVHO1FBQ0gsdUNBQUksR0FBSixVQUFLLGdCQUEwQjtZQUEvQixpQkFrQ0M7WUFoQ0csRUFBRSxDQUFDLENBQUMsZ0JBQWdCLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQztnQkFDM0IsSUFBSSxDQUFDLGtCQUFrQixHQUFHLGdCQUFnQixDQUFDO1lBQy9DLENBQUM7WUFFRCxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDO2dCQUFDLE1BQU0sQ0FBQyxDQUFDLDhEQUE4RDtZQUV0RyxJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQztZQUN2QixJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUM7WUFFakUsNENBQTRDO1lBQzVDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUM7Z0JBRTFCLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDO2dCQUN4QixXQUFXLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRTtvQkFDbEIsWUFBWSxFQUFFLE1BQU07aUJBQ3ZCLENBQUM7cUJBQ0csSUFBSSxDQUFDLFVBQUMsUUFBUTtvQkFDWCxLQUFJLENBQUMsa0JBQWtCLEdBQUcsS0FBSyxDQUFDO29CQUNoQyxLQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUE7b0JBQ2xDLEtBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLHVCQUF1QjtvQkFDdkMsS0FBSSxDQUFDLFdBQVcsR0FBRyxLQUFLLENBQUM7Z0JBQzdCLENBQUMsQ0FBQztxQkFDRCxTQUFTLENBQUMsVUFBQyxHQUFHO29CQUNYLE9BQU8sQ0FBQyxLQUFLLENBQUMsa0NBQWtDLEdBQUcsR0FBRyxDQUFDLENBQUM7b0JBQ3hELEtBQUksQ0FBQyxXQUFXLEdBQUcsS0FBSyxDQUFDO2dCQUM3QixDQUFDLENBQUMsQ0FBQztZQUNYLENBQUM7WUFDRCxJQUFJLENBQUMsQ0FBQztnQkFDRiwrQkFBK0I7Z0JBQy9CLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUVuQixDQUFDO1FBQ0wsQ0FBQztRQUVEOzs7V0FHRztRQUNILDBDQUFPLEdBQVAsVUFBUSxJQUF5QjtZQUM3QixJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQztZQUN4QixJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDaEIsQ0FBQztRQUVELHVDQUFJLEdBQUo7WUFDSSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztnQkFDZCxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ3ZCLENBQUM7UUFDTCxDQUFDO1FBRUQsd0NBQUssR0FBTDtZQUNJLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNoQixDQUFDO1FBR0Q7O1dBRUc7UUFDSyx3Q0FBSyxHQUFiO1lBQ0ksTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEtBQUssSUFBSSxHQUFHLEtBQUssQ0FBQztRQUNyRSxDQUFDO1FBRUQ7O1dBRUc7UUFDSywwQ0FBTyxHQUFmO1lBQUEsaUJBcUJDO1lBcEJHLFVBQVUsQ0FBQztnQkFDUCxFQUFFLENBQUMsQ0FBQyxLQUFJLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDO29CQUNmLEtBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUNiLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxLQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQ3ZELEtBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUNwQixLQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFDckIsQ0FBQyxDQUFDLEtBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxFQUFFLEtBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsRUFBRSxLQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQ25GLENBQUM7b0JBRUYsS0FBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO29CQUVoQixLQUFJLENBQUMsVUFBVSxHQUFHLEtBQUssQ0FBQztvQkFFeEIsNENBQTRDO29CQUM1QyxFQUFFLENBQUMsQ0FBQyxLQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQzt3QkFDbkIsS0FBSSxDQUFDLFdBQVcsR0FBRyxLQUFLLENBQUM7d0JBQ3pCLEtBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztvQkFDaEIsQ0FBQztnQkFDTCxDQUFDO1lBQ0wsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ1osQ0FBQztRQUVEOzs7V0FHRztRQUNLLDZDQUFVLEdBQWxCLFVBQW1CLElBQUs7WUFDcEIsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDZixJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksS0FBSyxDQUNuQixJQUFJLENBQUMsU0FBUyxFQUNkLFNBQVMsRUFDVCxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7WUFDN0IsQ0FBQztRQUNMLENBQUM7UUFFRDs7OztXQUlHO1FBQ0ssNkNBQVUsR0FBbEIsVUFBbUIsS0FBYSxFQUFFLE1BQWM7WUFFNUMsbUhBQW1IO1lBQ25ILElBQUksTUFBTSxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDO1lBQ3JDLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO2dCQUN4QyxNQUFNLEdBQVcsZ0JBQWdCLENBQUMsdUJBQXVCLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDdEUsQ0FBQztZQUVELElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxLQUFLLENBQUMsRUFBRSxDQUFDLEVBQUUsTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7WUFDaEUsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLEtBQUssQ0FBQyxFQUFFLENBQUMsRUFBRSxNQUFNLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxNQUFNLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztZQUVoRSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUNmLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztnQkFDN0IsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO2dCQUMvQix3Q0FBd0M7Z0JBQ3hDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQ2pFLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxHQUFHLEdBQUcsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztnQkFDaEQsQ0FBQztZQUNMLENBQUM7UUFDTCxDQUFDO1FBRUQ7OztXQUdHO1FBQ0ssb0RBQWlCLEdBQXpCLFVBQTBCLEdBQUc7WUFBN0IsaUJBc0JDO1lBckJHLDJHQUEyRztZQUMzRyxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7WUFDdEIsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztnQkFDakQsSUFBSSxDQUFDLFdBQVcsR0FBRyxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQztZQUMxQyxDQUFDO1lBRUQsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDZixJQUFJLENBQUMsWUFBWSxHQUFHLEdBQUcsQ0FBQyxTQUFTLENBQUM7Z0JBQ2xDLHVEQUF1RDtnQkFDdkQsVUFBVSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLFVBQVUsRUFBRSxjQUFNLE9BQUEsS0FBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEVBQWpDLENBQWlDLENBQUMsQ0FBQztZQUNoRyxDQUFDO1lBQ0QsSUFBSSxDQUFDLENBQUM7Z0JBQ0YsSUFBSSxDQUFDLFlBQVksR0FBRyxHQUFHLENBQUMsU0FBUyxDQUFDO2dCQUNsQyxJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUN0QyxDQUFDO1lBQ0QsVUFBVSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxZQUFZLEVBQUUsVUFBQyxZQUFZLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxJQUFJLElBQUssT0FBQSxLQUFJLENBQUMsZUFBZSxDQUFDLFlBQVksRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLElBQUksQ0FBQyxFQUE5QyxDQUE4QyxDQUFDLENBQUM7WUFFcEksRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFlBQVksS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDO2dCQUM3QixHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsY0FBYyxFQUFFLFVBQUMsR0FBRyxJQUFLLE9BQUEsS0FBSSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxFQUExQixDQUEwQixDQUFDLENBQUM7WUFDL0UsQ0FBQztRQUVMLENBQUM7UUFFRDs7O1dBR0c7UUFDSyxnREFBYSxHQUFyQixVQUFzQixTQUFTO1lBQzNCLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQ2YscUZBQXFGO2dCQUNyRixJQUFJLENBQUMsU0FBUyxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQ2xELFNBQVMsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7Z0JBRXhELHVCQUF1QjtnQkFDdkIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsUUFBUSxHQUFHLFVBQVUsQ0FBQztnQkFDM0MsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxHQUFHLEdBQUcsQ0FBQztnQkFDaEMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQztZQUNuQyxDQUFDO1lBQ0QsSUFBSSxDQUFDLENBQUM7Z0JBQ0Ysa0RBQWtEO1lBQ3RELENBQUM7WUFFRCwrQ0FBK0M7WUFDL0MsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1FBQ3RCLENBQUM7UUFHRDs7V0FFRztRQUNLLGtEQUFlLEdBQXZCLFVBQXdCLFlBQVksRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLElBQUk7WUFDNUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDO2dCQUFDLE1BQU0sQ0FBQztZQUU5QixFQUFFLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7Z0JBQ2hCLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO29CQUNkLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUM7d0JBQ2YsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLDRDQUE0Qzt3QkFDaEUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQztvQkFDckcsQ0FBQztnQkFDTCxDQUFDO1lBQ0wsQ0FBQztZQUNELElBQUksQ0FBQyxDQUFDO2dCQUNGLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO29CQUNsQixJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQztnQkFDNUIsQ0FBQztnQkFDRCxJQUFJLENBQUMsQ0FBQztvQkFFRixFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLHdCQUF3QixDQUFDLENBQUMsQ0FBQzt3QkFDL0MsSUFBSSxDQUFDLHNCQUFzQixFQUFFLENBQUM7b0JBQ2xDLENBQUM7b0JBRUQsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUNoQixDQUFDO1lBQ0wsQ0FBQztRQUNMLENBQUM7UUFFTyx5REFBc0IsR0FBOUI7WUFDSSxJQUFJLFdBQVcsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQztZQUN4QyxJQUFJLFFBQVEsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLHdCQUF3QixDQUFDLFNBQVMsQ0FBQztZQUN0RSxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLHdCQUF3QixDQUFDLGtCQUFrQixDQUFDO1lBRXpFLEVBQUUsQ0FBQyxDQUFDLFdBQVcsR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDO2dCQUN6QixJQUFJLFFBQVEsR0FBRyxDQUFDLFdBQVcsR0FBRyxRQUFRLENBQUMsQ0FBQztnQkFDeEMsRUFBRSxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsd0JBQXdCLENBQUMsa0JBQWtCLEdBQUcsQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyx3QkFBd0IsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUMvSSxDQUFDO1lBQ0QsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLFdBQVcsR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDO2dCQUM5QixJQUFJLFFBQVEsR0FBRyxRQUFRLEdBQUcsV0FBVyxDQUFDO2dCQUN0QyxFQUFFLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyx3QkFBd0IsQ0FBQyxrQkFBa0IsR0FBRyxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLHdCQUF3QixDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQy9JLENBQUM7WUFFRCxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyx3QkFBd0IsQ0FBQyxhQUFhLENBQUM7Z0JBQUMsRUFBRSxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsd0JBQXdCLENBQUMsYUFBYSxDQUFDO1lBQ3JJLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyx3QkFBd0IsQ0FBQyxhQUFhLENBQUM7Z0JBQUMsRUFBRSxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsd0JBQXdCLENBQUMsYUFBYSxDQUFDO1lBRTFJLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztnQkFDOUIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxtQkFBbUIsR0FBRyxFQUFFLENBQUM7WUFDekMsQ0FBQztRQUVMLENBQUM7UUFFTyxtREFBZ0IsR0FBeEIsVUFBeUIsR0FBRztZQUN4QixFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDO2dCQUFDLE1BQU0sQ0FBQztZQUUxQyxJQUFJLFFBQVEsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ3RDLElBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQ3JFLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO2dCQUN2QyxLQUFLLEdBQVUsZ0JBQWdCLENBQUMsdUJBQXVCLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDbkUsQ0FBQztZQUVELElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3JELElBQUksTUFBTSxHQUFnQjtnQkFDdEIsS0FBSyxFQUFFLEtBQUs7Z0JBQ1osTUFBTSxFQUFFLElBQUk7YUFDZixDQUFDO1lBRUYsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUMxRCw0R0FBNEc7Z0JBQzVHLElBQUksQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFLE1BQU0sQ0FBQyxDQUFDO2dCQUNsQyxNQUFNLENBQUM7WUFDWCxDQUFDO1lBRUQsa0RBQWtEO1lBQ2xELE1BQU0sQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDeEQsTUFBTSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3hELElBQUksQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBRXRDLENBQUM7UUFFRDs7OztXQUlHO1FBQ0ssaURBQWMsR0FBdEIsVUFBdUIsR0FBRyxFQUFFLEdBQUc7WUFDM0IsSUFBSSxRQUFRLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzlELE1BQU0sQ0FBQyxRQUFRLENBQUM7UUFDcEIsQ0FBQztRQUVEOzs7O1dBSUc7UUFDSyxtREFBZ0IsR0FBeEIsVUFBeUIsR0FBRyxFQUFFLEdBQUc7WUFFN0IsSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3pELElBQUksU0FBUyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxHQUFHLEdBQUcsRUFBRSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7WUFDakQsSUFBSSxrQkFBa0IsR0FBRyxTQUFTLEdBQUcsR0FBRyxHQUFHLElBQUksQ0FBQyxFQUFFLEdBQUcsR0FBRyxDQUFDO1lBRXpELGtCQUFrQixJQUFJLEdBQUcsQ0FBQztZQUMxQixFQUFFLENBQUMsQ0FBQyxrQkFBa0IsSUFBSSxHQUFHLENBQUM7Z0JBQUMsa0JBQWtCLElBQUksR0FBRyxDQUFDO1lBRXpELE1BQU0sQ0FBQyxrQkFBa0IsQ0FBQztRQUM5QixDQUFDO1FBR08sK0NBQVksR0FBcEIsVUFBcUIsR0FBRztZQUNwQix1R0FBdUc7WUFDdkcsSUFBSSxTQUFTLEdBQVEsSUFBSSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUM7WUFDaEQsSUFBSSxJQUFJLEdBQUcsU0FBUyxDQUFDLHFCQUFxQixFQUFFLENBQUM7WUFDN0MsTUFBTSxDQUFDO2dCQUNILENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxJQUFJO2dCQUNwQixDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsR0FBRzthQUN0QixDQUFDO1FBQ04sQ0FBQztRQUdEOztXQUVHO1FBQ0ssOENBQVcsR0FBbkIsVUFBb0IsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQztZQUMxQixFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDO2dCQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDcEMsSUFBSSxDQUFDLGtCQUFrQixHQUFHLElBQUksQ0FBQztZQUMvQixJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDaEIsQ0FBQztRQUVEOztXQUVHO1FBQ0ssa0RBQWUsR0FBdkIsVUFBd0IsT0FBTyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQztZQUNwQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7Z0JBQ1gsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQztvQkFBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ3hDLENBQUM7WUFDRCxJQUFJLENBQUMsQ0FBQztnQkFDRixJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDaEIsQ0FBQztRQUVMLENBQUM7UUFFRDs7V0FFRztRQUNLLHlEQUFzQixHQUE5QixVQUErQixVQUFVLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDO1lBQzlDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQztnQkFBQyxNQUFNLENBQUM7WUFDekIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNuQixJQUFJLENBQUMsTUFBTSxDQUFDLGlCQUFpQixDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQzFDLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNoQixDQUFDO1FBRU8sMkNBQVEsR0FBaEI7WUFDSSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7Z0JBQzlCLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztvQkFFbEQsd0dBQXdHO29CQUN4RyxJQUFJLENBQUMsR0FBRyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO29CQUV0QyxpREFBaUQ7b0JBQ2pELENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLENBQUM7b0JBQ3BELElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDO29CQUNkLE1BQU0sQ0FBQztnQkFDWCxDQUFDO1lBQ0wsQ0FBQztZQUVELElBQUksQ0FBQyxJQUFJLEdBQUcsU0FBUyxDQUFDO1FBQzFCLENBQUM7UUFuWkQ7WUFEQyxHQUFHLENBQUMsUUFBUSxFQUFFOzs2REFDSDtRQUdaO1lBREMsR0FBRyxDQUFDLFFBQVEsRUFBRTs7d0VBQ2dCO1FBRy9CO1lBREMsR0FBRyxDQUFDLFFBQVEsRUFBRTs7c0VBQ087UUFHdEI7WUFEQyxHQUFHLENBQUMsUUFBUSxFQUFFOztxRUFDTTtRQVpaLHdCQUF3QjtZQURwQyxHQUFHLENBQUMsUUFBUSxDQUFDLDBCQUEwQixDQUFDOztXQUM1Qix3QkFBd0IsQ0F1WnBDO1FBQUQsK0JBQUM7S0F2WkQsQUF1WkMsQ0F2WjZDLEdBQUcsQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLEdBdVp4RTtJQXZaWSw0REFBd0I7SUEyWnJDOzs7Ozs7Ozs7T0FTRztJQUNIO1FBb0NJLGVBQVksTUFBeUIsRUFBRSxJQUFVLEVBQUUsT0FBd0I7WUFuQjNFLHFCQUFnQixHQUFHLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLHVEQUF1RDtZQXFCeEYsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7WUFDckIsRUFBRSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUM7Z0JBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQztZQUMzQixJQUFJLENBQUMsaUJBQWlCLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDaEMsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUM7UUFFekIsQ0FBQztRQUVELHVCQUFPLEdBQVAsVUFBUSxJQUFJO1lBQ1IsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUM7UUFDekIsQ0FBQztRQUVELGlDQUFpQixHQUFqQixVQUFrQixPQUF1QjtZQUNyQyxJQUFJLENBQUMsc0JBQXNCLEdBQUcsT0FBTyxDQUFDLFdBQVcsSUFBSSxDQUFDLENBQUMsQ0FBQyx3REFBd0Q7WUFDaEgsSUFBSSxDQUFDLHNCQUFzQixHQUFHLE9BQU8sQ0FBQyxXQUFXLElBQUksRUFBRSxDQUFDLENBQUMsd0RBQXdEO1lBQ2pILElBQUksQ0FBQyxjQUFjLEdBQUcsQ0FBQyxPQUFPLENBQUMsYUFBYSxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsd0VBQXdFO1lBQ2xMLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxPQUFPLENBQUMsV0FBVyxJQUFJLEVBQUUsQ0FBQyxDQUFDLCtEQUErRDtZQUNsSCxJQUFJLENBQUMsbUJBQW1CLEdBQUcsT0FBTyxDQUFDLFNBQVMsSUFBSSxDQUFDLENBQUMsQ0FBQyxpQ0FBaUM7WUFFcEYsbUNBQW1DO1lBQ25DLElBQUksQ0FBQyxtQkFBbUIsR0FBRyxPQUFPLENBQUMsa0JBQWtCLElBQUksQ0FBQyxDQUFDO1lBRTNELElBQUksQ0FBQyxrQkFBa0IsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUMscURBQXFEO1lBQ2hJLElBQUksQ0FBQyxVQUFVLEdBQUcsT0FBTyxDQUFDLFNBQVMsSUFBSSxFQUFFLENBQUM7WUFDMUMsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLDRCQUE0QjtZQUV0RSxJQUFJLGlCQUFpQixHQUFHLENBQUMsaUJBQWlCLEVBQUUsaUJBQWlCLEVBQUUsa0JBQWtCLEVBQUUsa0JBQWtCLEVBQUUsa0JBQWtCLEVBQUUsa0JBQWtCLEVBQUUsaUJBQWlCLEVBQUUsaUJBQWlCLEVBQUUsZ0JBQWdCLEVBQUUsZ0JBQWdCLEVBQUUsZUFBZSxDQUFDLENBQUM7WUFDMU8sSUFBSSxDQUFDLFVBQVUsR0FBRyxPQUFPLENBQUMsVUFBVSxJQUFJLGlCQUFpQixDQUFDO1FBQzlELENBQUM7UUFFRCxxQkFBSyxHQUFMLFVBQU0sTUFBTSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsTUFBTTtZQUFuQyxpQkFzQkM7WUFwQkcsSUFBSSxTQUFTLEdBQUc7Z0JBQ1osS0FBSyxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNqQyxLQUFLLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ2pDLElBQUksRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDaEMsSUFBSSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNoQyxLQUFLLEVBQUUsS0FBSztnQkFDWixNQUFNLEVBQUUsTUFBTTthQUNqQixDQUFDO1lBRUYsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1lBRVosYUFBYTtZQUNiLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxVQUFDLFVBQVU7Z0JBQ3JDLElBQUksV0FBVyxHQUFHLEtBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFFLEtBQUssRUFBRSxNQUFNLENBQUMsQ0FBQztnQkFDMUQsS0FBSSxDQUFDLGdCQUFnQixDQUFDLFVBQVUsRUFBRSxXQUFXLEVBQUUsU0FBUyxFQUFFLFVBQUMsTUFBTSxFQUFFLEtBQUs7b0JBQ3BFLHdDQUF3QztvQkFDeEMsS0FBSyxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7b0JBQ3BCLEtBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDdEMsQ0FBQyxDQUFDLENBQUM7WUFDUCxDQUFDLENBQUMsQ0FBQztRQUNQLENBQUM7UUFFRCxvQkFBSSxHQUFKO1lBQ0ksRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQztnQkFBQyxLQUFLLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ3ZDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUM7Z0JBQUMsb0JBQW9CLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxDQUFDO1FBQ3ZFLENBQUM7UUFFRDs7Ozs7U0FLQztRQUNELDJCQUFXLEdBQVgsVUFBWSxDQUFDLEVBQUUsQ0FBQztZQUVaLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztnQkFBQyxNQUFNLENBQUMsSUFBSSxDQUFDO1lBRTVCLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxFQUFFLEVBQUUsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLHNEQUFzRDtZQUN6RyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLG1EQUFtRDtZQUVwRixFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQ3hCLDJFQUEyRTtnQkFDM0UsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDO2dCQUM1QixDQUFDLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO1lBQzdCLENBQUM7WUFHRCxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUNsQixFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQztZQUNoQixJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUNsQixFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQztZQUVoQixJQUFJLEdBQUcsQ0FBQztZQUNSLEVBQUUsQ0FBQyxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDdEIsSUFBSSxHQUFHLEdBQUcsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDO2dCQUNsQixJQUFJLEdBQUcsR0FBRyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JBQ2xCLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUNsRSxJQUFJLEdBQUcsR0FBRyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUM7b0JBQ2xCLElBQUksR0FBRyxHQUFHLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQztvQkFDbEIsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQzt3QkFDekMsbURBQW1EO3dCQUNuRCxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEdBQUcsRUFBRSxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO29CQUN4RSxDQUFDO2dCQUNMLENBQUM7WUFDTCxDQUFDO1lBQ0QsTUFBTSxDQUFDLElBQUksQ0FBQztRQUNoQixDQUFDO1FBRU8seUJBQVMsR0FBakIsVUFBa0IsSUFBSSxFQUFFLFFBQVE7WUFFNUIsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3hDLElBQUksTUFBTSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDO1lBRWpDLElBQUksQ0FBQyxFQUFFLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQztZQUNyQixJQUFJLENBQUMsRUFBRSxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyx3Q0FBd0M7WUFFOUQsSUFBSSxDQUFDLEVBQUUsR0FBRyxNQUFNLENBQUMsRUFBRSxDQUFDO1lBQ3BCLElBQUksQ0FBQyxFQUFFLEdBQUcsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLGdFQUFnRTtZQUVyRixJQUFJLENBQUMsRUFBRSxHQUFHLE1BQU0sQ0FBQyxFQUFFLENBQUM7WUFDcEIsSUFBSSxDQUFDLEVBQUUsR0FBRyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMscURBQXFEO1lBRTFFLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ3JDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLEdBQUcsTUFBTSxDQUFDLFlBQVksQ0FBQyxDQUFDO1lBRS9ELElBQUksQ0FBQyxTQUFTLEdBQUcsTUFBTSxDQUFDLFFBQVEsQ0FBQztZQUVqQyxJQUFJLENBQUMsSUFBSSxHQUFHLEVBQUUsQ0FBQztZQUNmLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUNWLElBQUksWUFBWSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksR0FBRyxDQUFDO1lBRXhELEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxRQUFRLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDeEIsNEVBQTRFO2dCQUM1RSxtRUFBbUU7Z0JBRW5FLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO29CQUMvQixJQUFJLEdBQUcsR0FBRyxFQUFFLENBQUM7b0JBQ2IsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFHLENBQUMsRUFBRSxFQUFFLENBQUM7d0JBQ3JDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDbEMsQ0FBQztvQkFDRCxFQUFFLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO3dCQUNmLDJGQUEyRjt3QkFDM0YsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDckIsQ0FBQztvQkFDRCxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQztnQkFDdkIsQ0FBQztZQUNMLENBQUM7WUFDRCxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLFFBQVEsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUM5Qiw2RUFBNkU7Z0JBQzdFLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztvQkFDcEMsSUFBSSxHQUFHLEdBQUcsRUFBRSxDQUFDO29CQUNiLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRyxDQUFDLEVBQUUsRUFBRSxDQUFDO3dCQUNyQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQ2xDLENBQUM7b0JBQ0QsRUFBRSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQzt3QkFDZiwyRkFBMkY7d0JBQzNGLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQ3JCLENBQUM7b0JBQ0QsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUM7Z0JBQ3ZCLENBQUM7WUFDTCxDQUFDO1lBRUQsUUFBUSxDQUFDO2dCQUNMLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSTtnQkFDZixXQUFXLEVBQUUsSUFBSSxDQUFDLFdBQVc7YUFDaEMsQ0FBQyxDQUFDO1FBQ1AsQ0FBQztRQUVPLDZCQUFhLEdBQXJCLFVBQXNCLElBQUk7WUFBMUIsaUJBOEVDO1lBN0VHLElBQUksS0FBSyxHQUFHLElBQUksRUFDWixLQUFLLEdBQUcsSUFBSSxFQUNaLE1BQU0sR0FBRyxJQUFJLEVBQ2IsYUFBYSxHQUFHLElBQUksRUFDcEIsU0FBUyxHQUFHLElBQUksQ0FBQztZQUVyQixJQUFJLFNBQVMsR0FBRyxJQUFJLENBQUM7WUFDckIsSUFBSSxZQUFZLENBQUM7WUFFakIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFDLE1BQU07Z0JBQ2hCLFlBQVksR0FBTSxNQUFNLENBQUMsTUFBTSxDQUFDLFVBQVUsU0FBSSxNQUFNLENBQUMsTUFBTSxDQUFDLGlCQUFpQixTQUFJLE1BQU0sQ0FBQyxNQUFNLENBQUMsZUFBaUIsQ0FBQztnQkFDakgsTUFBTSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztvQkFDbkIsS0FBSyxPQUFPLENBQUM7b0JBQ2IsS0FBSyxPQUFPO3dCQUNSLEtBQUssR0FBRyxNQUFNLENBQUMsQ0FBQyxpREFBaUQ7d0JBQ2pFLEtBQUssQ0FBQztvQkFDVixLQUFLLE9BQU8sQ0FBQztvQkFDYixLQUFLLE9BQU87d0JBQ1IsS0FBSyxHQUFHLE1BQU0sQ0FBQyxDQUFDLGlEQUFpRDt3QkFDakUsS0FBSyxDQUFDO29CQUNWLEtBQUssUUFBUSxDQUFDO29CQUNkLEtBQUssU0FBUyxDQUFDO29CQUNmLEtBQUssT0FBTzt3QkFDUixhQUFhLEdBQUcsTUFBTSxDQUFDLENBQUMsMEJBQTBCO3dCQUNsRCxLQUFLLENBQUM7b0JBQ1YsS0FBSyxRQUFRLENBQUM7b0JBQ2QsS0FBSyxRQUFRLENBQUM7b0JBQ2QsS0FBSyxPQUFPO3dCQUNSLFNBQVMsR0FBRyxNQUFNLENBQUMsQ0FBQyx1QkFBdUI7d0JBQzNDLEtBQUssQ0FBQztvQkFDVjt3QkFDSSxTQUFTLEdBQUcsS0FBSyxDQUFDO3dCQUNsQixNQUFNLENBQUM7Z0JBQ2YsQ0FBQztnQkFFRCw4RUFBOEU7Z0JBQzlFLEtBQUksQ0FBQyxPQUFPLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUM7Z0JBQ3JDLEtBQUksQ0FBQyxZQUFZLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUM7WUFDbkQsQ0FBQyxDQUFDLENBQUM7WUFFSCxFQUFFLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7Z0JBQ2IsT0FBTyxDQUFDLEtBQUssQ0FBQyxxRUFBcUUsR0FBRyxZQUFZLENBQUMsQ0FBQztnQkFDcEcsTUFBTSxDQUFDLFNBQVMsQ0FBQztZQUNyQixDQUFDO1lBR0QsRUFBRSxDQUFDLENBQUMsYUFBYSxJQUFJLFNBQVMsQ0FBQyxDQUFDLENBQUM7Z0JBQzdCLHNFQUFzRTtnQkFDdEUsS0FBSyxHQUFHLEVBQUUsQ0FBQztnQkFDWCxLQUFLLENBQUMsTUFBTSxHQUFHLGFBQWEsQ0FBQyxNQUFNLENBQUM7Z0JBQ3BDLEtBQUssR0FBRyxFQUFFLENBQUM7Z0JBQ1gsS0FBSyxDQUFDLE1BQU0sR0FBRyxhQUFhLENBQUMsTUFBTSxDQUFDO2dCQUNwQyxLQUFLLENBQUMsSUFBSSxHQUFHLEVBQUUsQ0FBQztnQkFDaEIsS0FBSyxDQUFDLElBQUksR0FBRyxFQUFFLENBQUM7Z0JBQ2hCLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHLEdBQUcsYUFBYSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO29CQUU1RCxJQUFJLEdBQUcsR0FBRyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUNoQyxJQUFJLEdBQUcsR0FBRyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUU1QixFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLElBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO3dCQUMvQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDO3dCQUNoQixLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDO3dCQUNoQixRQUFRLENBQUM7b0JBQ2IsQ0FBQztvQkFFRCxJQUFJLEdBQUcsR0FBRyxHQUFHLEdBQUcsSUFBSSxDQUFDLEVBQUUsR0FBRyxHQUFHLENBQUM7b0JBQzlCLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7b0JBQzdCLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7b0JBRTdCLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO29CQUNsQixLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFFdEIsQ0FBQztZQUNMLENBQUM7WUFHRCxNQUFNLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQztRQUNoRCxDQUFDO1FBRU8saUNBQWlCLEdBQXpCLFVBQTBCLEtBQUssRUFBRSxLQUFLO1lBQ2xDLElBQUksS0FBSyxHQUFHLEtBQUssQ0FBQyxJQUFJLEVBQ2xCLEtBQUssR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDO1lBQ3ZCLE1BQU0sQ0FBQztnQkFDSCxNQUFNLEVBQUUsS0FBSyxDQUFDLE1BQU07Z0JBQ3BCLElBQUksRUFBRSxjQUFjLENBQUM7b0JBQ2pCLE1BQU0sQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDaEMsQ0FBQztnQkFDRCxXQUFXLEVBQUUsSUFBSSxDQUFDLHlCQUF5QjthQUM5QyxDQUFDO1FBQ04sQ0FBQztRQUdPLDJCQUFXLEdBQW5CLFVBQW9CLE1BQU0sRUFBRSxLQUFLLEVBQUUsTUFBTTtZQUNyQyxJQUFJLFNBQVMsR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDMUIsSUFBSSxVQUFVLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzNCLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDakMsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQzlDLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFDekQsSUFBSSxJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztZQUMxRCxNQUFNLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxDQUFDO1FBQ2pGLENBQUM7UUFHRCw4Q0FBOEM7UUFDdEMseUNBQXlCLEdBQWpDLFVBQWtDLENBQUMsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRztZQUN0RCxJQUFJLEVBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ2YsSUFBSSxFQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUNmLElBQUksQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQ1gsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLEVBQ1YsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQ1YsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDZCxJQUFJLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQzFELElBQUksQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDMUQsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDNUMsQ0FBQztRQUVPLHVCQUFPLEdBQWYsVUFBZ0IsR0FBRztZQUNmLE1BQU0sQ0FBQyxHQUFHLEdBQUcsR0FBRyxHQUFHLElBQUksQ0FBQyxFQUFFLENBQUM7UUFDL0IsQ0FBQztRQUVPLHVCQUFPLEdBQWYsVUFBZ0IsR0FBRztZQUNmLE1BQU0sQ0FBQyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxHQUFHLEtBQUssQ0FBQyxDQUFDO1FBQ25DLENBQUM7UUFFRDs7VUFFRTtRQUNNLHVCQUFPLEdBQWYsVUFBZ0IsQ0FBQztZQUNiLE1BQU0sQ0FBQyxDQUFDLEtBQUssSUFBSSxJQUFJLENBQUMsS0FBSyxTQUFTLENBQUM7UUFDekMsQ0FBQztRQUVEOzs7VUFHRTtRQUNNLHdCQUFRLEdBQWhCLFVBQWlCLENBQUMsRUFBRSxDQUFDO1lBQ2pCLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ3JDLENBQUM7UUFFRDs7VUFFRTtRQUNNLHFCQUFLLEdBQWIsVUFBYyxDQUFDLEVBQUUsS0FBSztZQUNsQixNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNyRCxDQUFDO1FBRUQ7O1VBRUU7UUFDTSx3QkFBUSxHQUFoQjtZQUNJLE1BQU0sQ0FBQyxDQUFDLGdFQUFnRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztRQUN4RyxDQUFDO1FBRUQ7OztVQUdFO1FBQ00sdUJBQU8sR0FBZixVQUFnQixVQUFVLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsS0FBSztZQUN0RCxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDO1lBQ3hCLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUM7WUFDeEIsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBRXZELGlEQUFpRDtZQUNqRCxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQzlCLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDOUIsTUFBTSxDQUFDLElBQUksQ0FBQztRQUNoQixDQUFDO1FBRU8sMEJBQVUsR0FBbEIsVUFBbUIsVUFBVSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxLQUFLO1lBQzVDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDO1lBQ3BCLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDM0IsSUFBSSxFQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFDeEIsSUFBSSxFQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFFeEIsSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUN4QyxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBRXhDLHlHQUF5RztZQUN6RyxpRkFBaUY7WUFDakYsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDO1lBQzlCLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUM7UUFDNUYsQ0FBQztRQUVPLHFCQUFLLEdBQWIsVUFBYyxHQUFHO1lBQ2IsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNyRCxDQUFDO1FBRU8sdUJBQU8sR0FBZixVQUFnQixHQUFHLEVBQUUsR0FBRyxFQUFFLEtBQUs7WUFDM0IsNkNBQTZDO1lBQzdDLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ25DLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ25DLElBQUksT0FBTyxHQUFHLEtBQUssQ0FBQyxLQUFLLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUN0RCxJQUFJLE9BQU8sR0FBRyxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxDQUFDO1lBRTNDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1lBQ3RDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsT0FBTyxDQUFDO1lBQ25ELENBQUMsR0FBRyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUMsR0FBRyxPQUFPLENBQUMsQ0FBQyxpQkFBaUI7WUFDM0MsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ2xCLENBQUM7UUFFTyxzQkFBTSxHQUFkLFVBQWUsQ0FBQyxFQUFFLENBQUMsRUFBRSxLQUFLO1lBQ3RCLElBQUksV0FBVyxHQUFHLEtBQUssQ0FBQyxJQUFJLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQztZQUMxQyxJQUFJLGNBQWMsR0FBRyxLQUFLLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUNuRixJQUFJLFVBQVUsR0FBRyxjQUFjLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDMUcsSUFBSSxRQUFRLEdBQUcsS0FBSyxDQUFDLE1BQU0sR0FBRyxVQUFVLENBQUM7WUFDekMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEdBQUcsQ0FBQyxDQUFDLEdBQUcsY0FBYyxDQUFDO1lBRXhDLElBQUksR0FBRyxHQUFHLEdBQUcsR0FBRyxJQUFJLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFDckUsSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEtBQUssQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUNqRixNQUFNLENBQUMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDdEIsQ0FBQztRQUdPLGdDQUFnQixHQUF4QixVQUF5QixJQUFJLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxRQUFRO1lBQXZELGlCQTJDQztZQXpDRyxJQUFJLFVBQVUsR0FBRyxFQUFFLENBQUM7WUFDcEIsSUFBSSxPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSyxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQzFFLElBQUksYUFBYSxHQUFHLElBQUksQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDLENBQUM7WUFFakUsSUFBSSxPQUFPLEdBQUcsRUFBRSxDQUFDO1lBQ2pCLElBQUksQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUM7WUFFakIsSUFBSSxpQkFBaUIsR0FBRyxVQUFDLENBQUM7Z0JBQ3RCLElBQUksTUFBTSxHQUFHLEVBQUUsQ0FBQztnQkFDaEIsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7b0JBQzlDLElBQUksS0FBSyxHQUFHLEtBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQztvQkFDdEMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQzt3QkFDUixJQUFJLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQ1osQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQzt3QkFDakIsRUFBRSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQzs0QkFDZCxvQ0FBb0M7NEJBQ3BDLElBQUksSUFBSSxHQUFHLEtBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDOzRCQUNsQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO2dDQUNQLElBQUksR0FBRyxLQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsYUFBYSxFQUFFLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztnQ0FDekUsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDOzRCQUNyQyxDQUFDO3dCQUNMLENBQUM7b0JBQ0wsQ0FBQztnQkFDTCxDQUFDO2dCQUNELE9BQU8sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQztZQUN6QyxDQUFDLENBQUM7WUFFRixJQUFJLGdCQUFnQixHQUFHO2dCQUNuQixJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7Z0JBQ3ZCLE9BQU8sQ0FBQyxHQUFHLE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQztvQkFDdEIsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQ3JCLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ1AsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxHQUFHLEtBQUssR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDO3dCQUM1QixrQkFBa0I7d0JBQ2xCLFVBQVUsQ0FBQyxjQUFNLE9BQUEsZ0JBQWdCLEVBQWhCLENBQWdCLEVBQUUsRUFBRSxDQUFDLENBQUM7d0JBQ3ZDLE1BQU0sQ0FBQztvQkFDWCxDQUFDO2dCQUNMLENBQUM7Z0JBQ0QsS0FBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1lBQ2hELENBQUMsQ0FBQztZQUNGLGdCQUFnQixFQUFFLENBQUM7UUFDdkIsQ0FBQztRQUdPLDJCQUFXLEdBQW5CLFVBQW9CLE9BQU8sRUFBRSxNQUFNLEVBQUUsUUFBUTtZQUE3QyxpQkErQkM7WUE3Qkc7OztjQUdFO1lBQ0YsSUFBSSxLQUFLLEdBQVEsVUFBQyxDQUFDLEVBQUUsQ0FBQztnQkFDbEIsSUFBSSxNQUFNLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDcEMsTUFBTSxDQUFDLE1BQU0sSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUksQ0FBQyxnQkFBZ0IsQ0FBQztZQUNwRSxDQUFDLENBQUE7WUFFRCwwR0FBMEc7WUFDMUcsMEdBQTBHO1lBQzFHLEtBQUssQ0FBQyxPQUFPLEdBQUc7Z0JBQ1osT0FBTyxHQUFHLEVBQUUsQ0FBQztZQUNqQixDQUFDLENBQUM7WUFFRixLQUFLLENBQUMsU0FBUyxHQUFHLFVBQUMsQ0FBQztnQkFDaEIsa0NBQWtDO2dCQUNsQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JBQ1QsSUFBSSxTQUFTLEdBQUcsQ0FBQyxDQUFDO2dCQUNsQixHQUFHLENBQUM7b0JBQ0EsQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDcEUsQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDekUsQ0FBQyxRQUFRLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssSUFBSSxJQUFJLFNBQVMsRUFBRSxHQUFHLEVBQUUsRUFBRTtnQkFDdEQsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQ1IsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQ1IsTUFBTSxDQUFDLENBQUMsQ0FBQztZQUNiLENBQUMsQ0FBQztZQUVGLFFBQVEsQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDNUIsQ0FBQztRQUVPLHVCQUFPLEdBQWYsVUFBZ0IsTUFBTSxFQUFFLEtBQUs7WUFBN0IsaUJBb0dDO1lBbEdHLElBQUksdUJBQXVCLEdBQUcsVUFBQyxHQUFHLEVBQUUsR0FBRztnQkFDbkMsS0FBSSxDQUFDLFVBQVUsQ0FBQyxRQUFRLEdBQUcsVUFBQyxDQUFDO29CQUN6QixnQ0FBZ0M7b0JBQ2hDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ2pJLENBQUMsQ0FBQztnQkFDRixNQUFNLENBQUMsS0FBSSxDQUFDLFVBQVUsQ0FBQztZQUMzQixDQUFDLENBQUE7WUFFRCxJQUFJLFdBQVcsR0FBRyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsc0JBQXNCLEVBQUUsSUFBSSxDQUFDLHNCQUFzQixDQUFDLENBQUM7WUFDcEcsSUFBSSxPQUFPLEdBQUcsV0FBVyxDQUFDLEdBQUcsQ0FBQztnQkFDMUIsTUFBTSxDQUFDLEVBQUUsQ0FBQztZQUNkLENBQUMsQ0FBQyxDQUFDO1lBRUgsSUFBSSxhQUFhLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsS0FBSyxHQUFHLE1BQU0sQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixHQUFHLElBQUksQ0FBQyxDQUFDO1lBQy9GLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQ2xCLGFBQWEsSUFBSSxJQUFJLENBQUMsa0JBQWtCLENBQUM7WUFDN0MsQ0FBQztZQUVELElBQUksYUFBYSxHQUFHLHFCQUFxQixDQUFDO1lBRTFDLElBQUksU0FBUyxHQUFHLEVBQUUsQ0FBQztZQUNuQixHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLGFBQWEsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO2dCQUNyQyxTQUFTLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsRUFBRSxHQUFHLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ3BHLENBQUM7WUFFRCxJQUFJLE1BQU0sR0FBRztnQkFDVCxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQUMsTUFBTTtvQkFDbkIsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7Z0JBQ3RCLENBQUMsQ0FBQyxDQUFDO2dCQUNILFNBQVMsQ0FBQyxPQUFPLENBQUMsVUFBQyxRQUFRO29CQUN2QixFQUFFLENBQUMsQ0FBQyxRQUFRLENBQUMsR0FBRyxHQUFHLEtBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUM7d0JBQ3ZDLEtBQUssQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQztvQkFDdEMsQ0FBQztvQkFDRCxJQUFJLENBQUMsR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDO29CQUNuQixJQUFJLENBQUMsR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDO29CQUNuQixJQUFJLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsNkJBQTZCO29CQUNsRCxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQ2IsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUM7d0JBQ2IsUUFBUSxDQUFDLEdBQUcsR0FBRyxLQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxvREFBb0Q7b0JBQzlGLENBQUM7b0JBQUMsSUFBSSxDQUFDLENBQUM7d0JBQ0osSUFBSSxFQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQzt3QkFDbEIsSUFBSSxFQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQzt3QkFDbEIsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDOzRCQUM1Qiw4RkFBOEY7NEJBQzlGLFFBQVEsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDOzRCQUNqQixRQUFRLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQzs0QkFDakIsT0FBTyxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7d0JBQ3BELENBQUM7d0JBQUMsSUFBSSxDQUFDLENBQUM7NEJBQ0osZ0VBQWdFOzRCQUNoRSxRQUFRLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQzs0QkFDaEIsUUFBUSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUM7d0JBQ3BCLENBQUM7b0JBQ0wsQ0FBQztvQkFDRCxRQUFRLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQztnQkFDdEIsQ0FBQyxDQUFDLENBQUM7WUFDUCxDQUFDLENBQUE7WUFFRCxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNyQyxDQUFDLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxtQkFBbUIsQ0FBQztZQUN2QyxDQUFDLENBQUMsU0FBUyxHQUFHLGFBQWEsQ0FBQztZQUM1QixDQUFDLENBQUMsV0FBVyxHQUFHLEdBQUcsQ0FBQztZQUVwQixJQUFJLElBQUksR0FBRztnQkFDUCxpQ0FBaUM7Z0JBQ2pDLElBQUksSUFBSSxHQUFHLFNBQVMsQ0FBQztnQkFDckIsQ0FBQyxDQUFDLHdCQUF3QixHQUFHLGdCQUFnQixDQUFDO2dCQUM5QyxDQUFDLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztnQkFDNUQsQ0FBQyxDQUFDLHdCQUF3QixHQUFHLElBQUksQ0FBQztnQkFDbEMsQ0FBQyxDQUFDLFdBQVcsR0FBRyxHQUFHLENBQUM7Z0JBRXBCLDRCQUE0QjtnQkFDNUIsT0FBTyxDQUFDLE9BQU8sQ0FBQyxVQUFDLE1BQU0sRUFBRSxDQUFDO29CQUN0QixFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7d0JBQ3BCLENBQUMsQ0FBQyxTQUFTLEVBQUUsQ0FBQzt3QkFDZCxDQUFDLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQzt3QkFDL0IsTUFBTSxDQUFDLE9BQU8sQ0FBQyxVQUFDLFFBQVE7NEJBQ3BCLENBQUMsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUM7NEJBQ2pDLENBQUMsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEVBQUUsRUFBRSxRQUFRLENBQUMsRUFBRSxDQUFDLENBQUM7NEJBQ25DLFFBQVEsQ0FBQyxDQUFDLEdBQUcsUUFBUSxDQUFDLEVBQUUsQ0FBQzs0QkFDekIsUUFBUSxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsRUFBRSxDQUFDO3dCQUM3QixDQUFDLENBQUMsQ0FBQzt3QkFDSCxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUM7b0JBQ2YsQ0FBQztnQkFDTCxDQUFDLENBQUMsQ0FBQztZQUNQLENBQUMsQ0FBQTtZQUVELElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUN0QixJQUFJLEtBQUssR0FBRztnQkFDUixLQUFLLENBQUMsYUFBYSxHQUFHLHFCQUFxQixDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUNuRCxJQUFJLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7Z0JBQ3JCLElBQUksS0FBSyxHQUFHLEdBQUcsR0FBRyxJQUFJLENBQUM7Z0JBQ3ZCLEVBQUUsQ0FBQyxDQUFDLEtBQUssR0FBRyxLQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztvQkFDMUIsSUFBSSxHQUFHLEdBQUcsR0FBRyxLQUFLLEdBQUcsS0FBSSxDQUFDLFVBQVUsQ0FBQztvQkFDckMsTUFBTSxFQUFFLENBQUM7b0JBQ1QsSUFBSSxFQUFFLENBQUM7Z0JBQ1gsQ0FBQztZQUNMLENBQUMsQ0FBQztZQUNGLEtBQUssRUFBRSxDQUFDO1FBQ1osQ0FBQztRQUNMLFlBQUM7SUFBRCxDQS9rQkEsQUEra0JDLElBQUE7SUFFRCxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUM7UUFDL0IsTUFBTSxDQUFDLG9CQUFvQixHQUFHLFVBQUMsRUFBRTtZQUM3QixZQUFZLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDckIsQ0FBQyxDQUFDO0lBQ04sQ0FBQyIsImZpbGUiOiJhbmltYXRlZEVudmlyb25tZW50TGF5ZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cclxuLy8gVGhlIE1JVCBMaWNlbnNlIChNSVQpXHJcbi8vXHJcbi8vIENvcHlyaWdodCAoYykgMjAxNyBOaWNrIENhbWVyb25cclxuLy9cclxuLy8gaHR0cHM6Ly9naXRodWIuY29tL25pY2tjYW0vQW5pbWF0ZWRFbnZpcm9ubWVudExheWVyXHJcbi8vXHJcbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhIFxyXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlIFwiU29mdHdhcmVcIiksIFxyXG4vLyB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmcgd2l0aG91dCBsaW1pdGF0aW9uIFxyXG4vLyB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCwgZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgXHJcbi8vIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXQgcGVyc29ucyB0byB3aG9tIHRoZSBcclxuLy8gU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgY29uZGl0aW9uczpcclxuXHJcbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIFxyXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cclxuXHJcbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1MgXHJcbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZLCBcclxuLy8gRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU4gTk8gRVZFTlQgU0hBTEwgXHJcbi8vIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLCBEQU1BR0VTIE9SIE9USEVSXHJcbi8vIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1IgT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIFxyXG4vLyBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEUgVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFxyXG4vLyBUSEUgU09GVFdBUkUuXHJcbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xyXG5cclxuaW1wb3J0ICogYXMgTWFwVmlldyBmcm9tIFwiZXNyaS92aWV3cy9NYXBWaWV3XCI7XHJcbmltcG9ydCAqIGFzIFNjZW5lVmlldyBmcm9tIFwiZXNyaS92aWV3cy9TY2VuZVZpZXdcIjtcclxuaW1wb3J0ICogYXMgR3JhcGhpY3NMYXllciBmcm9tIFwiZXNyaS9sYXllcnMvR3JhcGhpY3NMYXllclwiO1xyXG5pbXBvcnQgKiBhcyBwcm9taXNlVXRpbHMgZnJvbSBcImVzcmkvY29yZS9wcm9taXNlVXRpbHNcIjtcclxuaW1wb3J0ICogYXMgZXNyaVJlcXVlc3QgZnJvbSBcImVzcmkvcmVxdWVzdFwiO1xyXG5pbXBvcnQgKiBhcyBFeHRlbnQgZnJvbSBcImVzcmkvZ2VvbWV0cnkvRXh0ZW50XCI7XHJcbmltcG9ydCAqIGFzIHdlYk1lcmNhdG9yVXRpbHMgZnJvbSBcImVzcmkvZ2VvbWV0cnkvc3VwcG9ydC93ZWJNZXJjYXRvclV0aWxzXCI7XHJcbmltcG9ydCAqIGFzIHdhdGNoVXRpbHMgZnJvbSBcImVzcmkvY29yZS93YXRjaFV0aWxzXCI7XHJcbmltcG9ydCAqIGFzIFNwYXRpYWxSZWZlcmVuY2UgZnJvbSBcImVzcmkvZ2VvbWV0cnkvU3BhdGlhbFJlZmVyZW5jZVwiO1xyXG5pbXBvcnQgKiBhcyBQb2ludCBmcm9tIFwiZXNyaS9nZW9tZXRyeS9Qb2ludFwiO1xyXG5pbXBvcnQgKiBhcyBhc2QgZnJvbSBcImVzcmkvY29yZS9hY2Nlc3NvclN1cHBvcnQvZGVjb3JhdG9yc1wiO1xyXG5pbXBvcnQgKiBhcyBxdWVyeSBmcm9tIFwiZG9qby9xdWVyeVwiO1xyXG5cclxuLyoqIFxyXG4gICAgVGhlIGF2YWlsYWJsZSBkaXNwbGF5IG9wdGlvbnMgdG8gY2hhbmVnIHRoZSBwYXJ0aWNsZSByZW5kZXJpbmdcclxuKi9cclxuZXhwb3J0IGludGVyZmFjZSBEaXNwbGF5T3B0aW9ucyB7XHJcbiAgICBtaW5WZWxvY2l0eT86IG51bWJlcjtcclxuICAgIG1heFZlbG9jaXR5PzogbnVtYmVyO1xyXG4gICAgdmVsb2NpdHlTY2FsZT86IG51bWJlcjtcclxuICAgIHBhcnRpY2xlQWdlPzogbnVtYmVyO1xyXG4gICAgcGFydGljbGVMaW5lV2lkdGg/OiBudW1iZXI7XHJcbiAgICBwYXJ0aWNsZU11bHRpcGxpZXI/OiBudW1iZXI7XHJcbiAgICBwYXJ0aWNsZU11bHRpcGxpZXJCeVpvb20/OiBQYXJ0aWNsZU11bHRpcGxpZXJCeVpvb20sXHJcbiAgICBmcmFtZVJhdGU/OiBudW1iZXI7XHJcbiAgICBjb2xvclNjYWxlPzogc3RyaW5nW107XHJcbiAgICBsaW5lV2lkdGg/OiBudW1iZXI7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICAgIEFuIHNpbXBsZSBvYmplY3QgdG8gZGVmaW5lIGR5bmFtaWMgcGFydGljbGUgbXVsdGlwbGllcnMgZGVwZW5kaW5nIG9uIGN1cnJlbnQgem9vbSBsZXZlbC5cclxuICAgIEEgYmFzaWMgYXR0ZW1wdCB0byBjYXRlciBmb3IgcGFydGljbGVzIGRpc3BsYXlpbmcgdG9vIGRlbnNlbHkgb24gY2xvc2UgaW4gem9vbSBsZXZlbHMuXHJcbiovXHJcbmV4cG9ydCBpbnRlcmZhY2UgUGFydGljbGVNdWx0aXBsaWVyQnlab29tIHtcclxuICAgIC8vIHRoZSBiYXNlIHpvb20gbGV2ZWwgdG8gc3RhcnQgY2FsY3VsYXRpbmcgYXQuIEZpbmQgYSBwYXJpdGljbGUgbXVsdGlwbGVyIGF0IHRoaXMgem9vbSBsZXZlbCB0aGF0IGxvb2tzIGdvb2QgZm9yIHlvdXIgZGF0YS5cclxuICAgIHpvb21MZXZlbDogbnVtYmVyLFxyXG5cclxuICAgIC8vIFRoZSBwYXJ0aWNsZSBtdWx0aXBsaWVyIGZvciB0aGUgYmFzZSB6b29tIGxldmVsIHNwZWNpZmllZCBhYm92ZS4gRmluZCBhIHBhcnRpY2xlIG11bHRpcGxlciBhdCB0aGlzIHpvb20gbGV2ZWwgdGhhdCBsb29rcyBnb29kIGZvciB5b3VyIGRhdGEuXHJcbiAgICBwYXJ0aWNsZU11bHRpcGxpZXI6IG51bWJlcixcclxuXHJcbiAgICAvLyBUaGUgYW1vdW50IHRvIHN1YnRyYWN0IG9yIGFkZCB0byB0aGUgcGFydGljbGUgbXVsdGlwbGllciBkZXBlbmRpbmcgb24gem9vbSBsZXZlbFxyXG4gICAgZGlmZlJhdGlvOiBudW1iZXIsXHJcblxyXG4gICAgLy8gdGhlIG1pbiB2YWx1ZSB0aGUgbXVsdGlwbGllciBjYW4gZ29cclxuICAgIG1pbk11bHRpcGxpZXI6IG51bWJlcixcclxuXHJcbiAgICAvLyB0aGUgbWF4IHZhbHVlIHRoZSBtdWx0aXBsaWVyIGNhbiBnb1xyXG4gICAgbWF4TXVsdGlwbGllcjogbnVtYmVyXHJcbn1cclxuXHJcblxyXG4vKipcclxuIFRoZSByZXR1cm4gb2JqZWN0IGZyb20gdGhlIHBvaW50LXJlcG9ydCBldmVudFxyXG4qL1xyXG5leHBvcnQgaW50ZXJmYWNlIFBvaW50UmVwb3J0IHtcclxuICAgIHBvaW50OiBQb2ludDtcclxuICAgIHRhcmdldDogQW5pbWF0ZWRFbnZpcm9ubWVudExheWVyO1xyXG4gICAgZGVncmVlPzogbnVtYmVyO1xyXG4gICAgdmVsb2NpdHk/OiBudW1iZXI7XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgQW5pbWF0ZWRFbnZpcm9ubWVudExheWVyUHJvcGVydGllcyBleHRlbmRzIF9fZXNyaS5HcmFwaGljc0xheWVyUHJvcGVydGllcyB7XHJcbiAgICBhY3RpdmVWaWV3PzogTWFwVmlldyB8IFNjZW5lVmlldztcclxuICAgIHVybD86IHN0cmluZztcclxuICAgIGRpc3BsYXlPcHRpb25zPzogRGlzcGxheU9wdGlvbnM7XHJcbiAgICByZXBvcnRWYWx1ZXM/OiBib29sZWFuO1xyXG59XHJcblxyXG5AYXNkLnN1YmNsYXNzKFwiQW5pbWF0ZWRFbnZpcm9ubWVudExheWVyXCIpXHJcbmV4cG9ydCBjbGFzcyBBbmltYXRlZEVudmlyb25tZW50TGF5ZXIgZXh0ZW5kcyBhc2QuZGVjbGFyZWQoR3JhcGhpY3NMYXllcikge1xyXG5cclxuICAgIEBhc2QucHJvcGVydHkoKVxyXG4gICAgdXJsOiBzdHJpbmc7XHJcblxyXG4gICAgQGFzZC5wcm9wZXJ0eSgpXHJcbiAgICBkaXNwbGF5T3B0aW9uczogRGlzcGxheU9wdGlvbnM7XHJcblxyXG4gICAgQGFzZC5wcm9wZXJ0eSgpXHJcbiAgICByZXBvcnRWYWx1ZXM6IGJvb2xlYW47XHJcblxyXG4gICAgQGFzZC5wcm9wZXJ0eSgpXHJcbiAgICBkYXRhTG9hZGluZzogYm9vbGVhbjtcclxuXHJcbiAgICBwcml2YXRlIF93aW5keTogV2luZHk7XHJcbiAgICBwcml2YXRlIF9kYXRhRmV0Y2hSZXF1aXJlZDogYm9vbGVhbjtcclxuXHJcbiAgICBwcml2YXRlIF9jYW52YXMyZDogSFRNTENhbnZhc0VsZW1lbnQ7XHJcbiAgICBwcml2YXRlIF9jYW52YXMzZDogSFRNTENhbnZhc0VsZW1lbnQ7XHJcblxyXG4gICAgcHJpdmF0ZSBfbGF5ZXJWaWV3MmQ6IGFueTtcclxuICAgIHByaXZhdGUgX2xheWVyVmlldzNkOiBhbnk7XHJcblxyXG4gICAgcHJpdmF0ZSBfc291dGhXZXN0OiBQb2ludDtcclxuICAgIHByaXZhdGUgX25vcnRoRWFzdDogUG9pbnQ7XHJcblxyXG4gICAgcHJpdmF0ZSBfYWN0aXZlVmlldzogTWFwVmlldyB8IFNjZW5lVmlldztcclxuICAgIHByaXZhdGUgX3ZpZXdMb2FkQ291bnQ6IG51bWJlciA9IDA7XHJcblxyXG4gICAgcHJpdmF0ZSBfaXNEcmF3aW5nOiBib29sZWFuID0gZmFsc2U7XHJcbiAgICBwcml2YXRlIF9xdWV1ZWREcmF3OiBib29sZWFuO1xyXG5cclxuXHJcbiAgICBkYXRlOiBEYXRlO1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKHByb3BlcnRpZXM6IEFuaW1hdGVkRW52aXJvbm1lbnRMYXllclByb3BlcnRpZXMpIHtcclxuICAgICAgICBzdXBlcihwcm9wZXJ0aWVzKTtcclxuXHJcbiAgICAgICAgLy8gSWYgdGhlIGFjdGl2ZSB2aWV3IGlzIHNldCBpbiBwcm9wZXJ0aWVzLCB0aGVuIHNldCBpdCBoZXJlLlxyXG4gICAgICAgIHRoaXMuX2FjdGl2ZVZpZXcgPSBwcm9wZXJ0aWVzLmFjdGl2ZVZpZXc7XHJcbiAgICAgICAgdGhpcy51cmwgPSBwcm9wZXJ0aWVzLnVybDtcclxuICAgICAgICB0aGlzLmRpc3BsYXlPcHRpb25zID0gcHJvcGVydGllcy5kaXNwbGF5T3B0aW9ucyB8fCB7fTtcclxuICAgICAgICB0aGlzLnJlcG9ydFZhbHVlcyA9IHByb3BlcnRpZXMucmVwb3J0VmFsdWVzID09PSBmYWxzZSA/IGZhbHNlIDogdHJ1ZTsgLy8gZGVmYXVsdCB0byB0cnVlXHJcblxyXG4gICAgICAgIHRoaXMub24oXCJsYXllcnZpZXctY3JlYXRlXCIsIChldnQpID0+IHRoaXMuX2xheWVyVmlld0NyZWF0ZWQoZXZ0KSk7XHJcblxyXG4gICAgICAgIC8vIHdhdGNoIHVybCBwcm9wIHNvIGEgZmV0Y2ggb2YgZGF0YSBhbmQgcmVkcmF3IHdpbGwgb2NjdXIuXHJcbiAgICAgICAgd2F0Y2hVdGlscy53YXRjaCh0aGlzLCBcInVybFwiLCAoYSwgYiwgYywgZCkgPT4gdGhpcy5fdXJsQ2hhbmdlZChhLCBiLCBjLCBkKSk7XHJcblxyXG4gICAgICAgIC8vIHdhdGNoIHVybCBwcm9wIHNvIGEgZmV0Y2ggb2YgZGF0YSBhbmQgcmVkcmF3IHdpbGwgb2NjdXIuXHJcbiAgICAgICAgd2F0Y2hVdGlscy53YXRjaCh0aGlzLCBcInZpc2libGVcIiwgKGEsIGIsIGMsIGQpID0+IHRoaXMuX3Zpc2libGVDaGFuZ2VkKGEsIGIsIGMsIGQpKTtcclxuXHJcbiAgICAgICAgLy8gd2F0Y2ggZGlzcGxheSBvcHRpb25zIHNvIHRvIHJlZHJhdyB3aGVuIGNoYW5nZWQuXHJcbiAgICAgICAgd2F0Y2hVdGlscy53YXRjaCh0aGlzLCBcImRpc3BsYXlPcHRpb25zXCIsIChhLCBiLCBjLCBkKSA9PiB0aGlzLl9kaXNwbGF5T3B0aW9uc0NoYW5nZWQoYSwgYiwgYywgZCkpO1xyXG4gICAgICAgIHRoaXMuX2RhdGFGZXRjaFJlcXVpcmVkID0gdHJ1ZTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFN0YXJ0IGEgZHJhd1xyXG4gICAgICovXHJcbiAgICBkcmF3KGZvcmNlRGF0YVJlZmV0Y2g/OiBib29sZWFuKSB7XHJcblxyXG4gICAgICAgIGlmIChmb3JjZURhdGFSZWZldGNoICE9IG51bGwpIHtcclxuICAgICAgICAgICAgdGhpcy5fZGF0YUZldGNoUmVxdWlyZWQgPSBmb3JjZURhdGFSZWZldGNoO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKCF0aGlzLnVybCB8fCAhdGhpcy52aXNpYmxlKSByZXR1cm47IC8vIG5vIHVybCBzZXQsIG5vdCB2aXNpYmxlIG9yIGlzIGN1cnJlbnRseSBkcmF3aW5nLCBleGl0IGhlcmUuXHJcblxyXG4gICAgICAgIHRoaXMuX2lzRHJhd2luZyA9IHRydWU7XHJcbiAgICAgICAgdGhpcy5fc2V0dXBEcmF3KHRoaXMuX2FjdGl2ZVZpZXcud2lkdGgsIHRoaXMuX2FjdGl2ZVZpZXcuaGVpZ2h0KTtcclxuXHJcbiAgICAgICAgLy8gaWYgZGF0YSBzaG91bGQgYmUgZmV0Y2hlZCwgZ28gZ2V0IGl0IG5vdy5cclxuICAgICAgICBpZiAodGhpcy5fZGF0YUZldGNoUmVxdWlyZWQpIHtcclxuXHJcbiAgICAgICAgICAgIHRoaXMuZGF0YUxvYWRpbmcgPSB0cnVlO1xyXG4gICAgICAgICAgICBlc3JpUmVxdWVzdCh0aGlzLnVybCwge1xyXG4gICAgICAgICAgICAgICAgcmVzcG9uc2VUeXBlOiBcImpzb25cIlxyXG4gICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICAgICAgLnRoZW4oKHJlc3BvbnNlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZGF0YUZldGNoUmVxdWlyZWQgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl93aW5keS5zZXREYXRhKHJlc3BvbnNlLmRhdGEpXHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZG9EcmF3KCk7IC8vIGFsbCBzb3J0ZWQgZHJhdyBub3cuXHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5kYXRhTG9hZGluZyA9IGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgfSlcclxuICAgICAgICAgICAgICAgIC5vdGhlcndpc2UoKGVycikgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBvY2N1cnJlZCByZXRyaWV2aW5nIGRhdGEuIFwiICsgZXJyKTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmRhdGFMb2FkaW5nID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIC8vIG5vIG5lZWQgZm9yIGRhdGEsIGp1c3QgZHJhdy5cclxuICAgICAgICAgICAgdGhpcy5fZG9EcmF3KCk7XHJcblxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFVwZGF0ZSB0aGUgYWN0aXZlIHZpZXcuIFRoZSB2aWV3IG11c3QgaGF2ZSBiZWVuIGFzc2lnbmVkIHRvIHRoZSBtYXAgcHJldmlvdXNseSBzbyB0aGF0IHRoaXMgbGF5ZXIgaGFzIGNyZWF0ZWQgb3IgdXNlZCB0aGUgY2FudmFzIGVsZW1lbnQgaW4gbGF5ZXJ2aWV3IGNyZWF0ZWQgYWxyZWFkeS5cclxuICAgICAqIEBwYXJhbSB2aWV3XHJcbiAgICAgKi9cclxuICAgIHNldFZpZXcodmlldzogTWFwVmlldyB8IFNjZW5lVmlldykge1xyXG4gICAgICAgIHRoaXMuX2FjdGl2ZVZpZXcgPSB2aWV3O1xyXG4gICAgICAgIHRoaXMuZHJhdygpO1xyXG4gICAgfVxyXG5cclxuICAgIHN0b3AoKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuX3dpbmR5KSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3dpbmR5LnN0b3AoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgc3RhcnQoKSB7XHJcbiAgICAgICAgdGhpcy5kcmF3KCk7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIC8qKlxyXG4gICAgICogSXMgdGhlIGFjdGl2ZSB2aWV3IDJkLlxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF9pczJkKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9hY3RpdmVWaWV3ID8gdGhpcy5fYWN0aXZlVmlldy50eXBlID09PSBcIjJkXCIgOiBmYWxzZTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENhbGwgdGhlIHdpbmR5IGRyYXcgbWV0aG9kXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgX2RvRHJhdygpIHtcclxuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuX2lzMmQoKSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fd2luZHkuc3RhcnQoXHJcbiAgICAgICAgICAgICAgICAgICAgW1swLCAwXSwgW3RoaXMuX2NhbnZhczJkLndpZHRoLCB0aGlzLl9jYW52YXMyZC5oZWlnaHRdXSxcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9jYW52YXMyZC53aWR0aCxcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9jYW52YXMyZC5oZWlnaHQsXHJcbiAgICAgICAgICAgICAgICAgICAgW1t0aGlzLl9zb3V0aFdlc3QueCwgdGhpcy5fc291dGhXZXN0LnldLCBbdGhpcy5fbm9ydGhFYXN0LngsIHRoaXMuX25vcnRoRWFzdC55XV1cclxuICAgICAgICAgICAgICAgICk7XHJcblxyXG4gICAgICAgICAgICAgICAgdGhpcy5fc2V0RGF0ZSgpO1xyXG5cclxuICAgICAgICAgICAgICAgIHRoaXMuX2lzRHJhd2luZyA9IGZhbHNlO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIGlmIHdlIGhhdmUgYSBxdWV1ZWQgZHJhdyBkbyBpdCByaWdodCBub3cuXHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fcXVldWVkRHJhdykge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3F1ZXVlZERyYXcgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmRyYXcoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sIDUwMCk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBJbml0IHRoZSB3aW5keSBjbGFzcyBcclxuICAgICAqIEBwYXJhbSBkYXRhXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgX2luaXRXaW5keShkYXRhPykge1xyXG4gICAgICAgIGlmICh0aGlzLl9pczJkKCkpIHtcclxuICAgICAgICAgICAgdGhpcy5fd2luZHkgPSBuZXcgV2luZHkoXHJcbiAgICAgICAgICAgICAgICB0aGlzLl9jYW52YXMyZCxcclxuICAgICAgICAgICAgICAgIHVuZGVmaW5lZCxcclxuICAgICAgICAgICAgICAgIHRoaXMuZGlzcGxheU9wdGlvbnMpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFNldHVwIHRoZSBnZW8gYm91bmRzIG9mIHRoZSBkcmF3aW5nIGFyZWFcclxuICAgICAqIEBwYXJhbSB3aWR0aFxyXG4gICAgICogQHBhcmFtIGhlaWdodFxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF9zZXR1cERyYXcod2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIpIHtcclxuXHJcbiAgICAgICAgLy8gdXNlIHRoZSBleHRlbnQgb2YgdGhlIHZpZXcsIGFuZCBub3QgdGhlIGV4dGVudCBwYXNzZWQgaW50byBmZXRjaEltYWdlLi4uaXQgd2FzIHNsaWdodGx5IG9mZiB3aGVuIGl0IGNyb3NzZWQgSURMLlxyXG4gICAgICAgIGxldCBleHRlbnQgPSB0aGlzLl9hY3RpdmVWaWV3LmV4dGVudDtcclxuICAgICAgICBpZiAoZXh0ZW50LnNwYXRpYWxSZWZlcmVuY2UuaXNXZWJNZXJjYXRvcikge1xyXG4gICAgICAgICAgICBleHRlbnQgPSA8RXh0ZW50PndlYk1lcmNhdG9yVXRpbHMud2ViTWVyY2F0b3JUb0dlb2dyYXBoaWMoZXh0ZW50KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuX25vcnRoRWFzdCA9IG5ldyBQb2ludCh7IHg6IGV4dGVudC54bWF4LCB5OiBleHRlbnQueW1heCB9KTtcclxuICAgICAgICB0aGlzLl9zb3V0aFdlc3QgPSBuZXcgUG9pbnQoeyB4OiBleHRlbnQueG1pbiwgeTogZXh0ZW50LnltaW4gfSk7XHJcblxyXG4gICAgICAgIGlmICh0aGlzLl9pczJkKCkpIHtcclxuICAgICAgICAgICAgdGhpcy5fY2FudmFzMmQud2lkdGggPSB3aWR0aDtcclxuICAgICAgICAgICAgdGhpcy5fY2FudmFzMmQuaGVpZ2h0ID0gaGVpZ2h0O1xyXG4gICAgICAgICAgICAvLyBjYXRlciBmb3IgdGhlIGV4dGVudCBjcm9zc2luZyB0aGUgSURMXHJcbiAgICAgICAgICAgIGlmICh0aGlzLl9zb3V0aFdlc3QueCA+IHRoaXMuX25vcnRoRWFzdC54ICYmIHRoaXMuX25vcnRoRWFzdC54IDwgMCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fbm9ydGhFYXN0LnggPSAzNjAgKyB0aGlzLl9ub3J0aEVhc3QueDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEhhbmRsZSBsYXllciB2aWV3IGNyZWF0ZWQuXHJcbiAgICAgKiBAcGFyYW0gZXZ0XHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgX2xheWVyVmlld0NyZWF0ZWQoZXZ0KSB7XHJcbiAgICAgICAgLy8gc2V0IHRoZSBhY3RpdmUgdmlldyB0byB0aGUgZmlyc3QgdmlldyBsb2FkZWQgaWYgdGhlcmUgd2Fzbid0IG9uZSBpbmNsdWRlZCBpbiB0aGUgY29uc3RydWN0b3IgcHJvcGVydGllcy5cclxuICAgICAgICB0aGlzLl92aWV3TG9hZENvdW50Kys7XHJcbiAgICAgICAgaWYgKHRoaXMuX3ZpZXdMb2FkQ291bnQgPT09IDEgJiYgIXRoaXMuX2FjdGl2ZVZpZXcpIHtcclxuICAgICAgICAgICAgdGhpcy5fYWN0aXZlVmlldyA9IGV2dC5sYXllclZpZXcudmlldztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICh0aGlzLl9pczJkKCkpIHtcclxuICAgICAgICAgICAgdGhpcy5fbGF5ZXJWaWV3MmQgPSBldnQubGF5ZXJWaWV3O1xyXG4gICAgICAgICAgICAvLyBmb3IgbWFwIHZpZXdzLCB3YWl0IGZvciB0aGUgbGF5ZXJ2aWV3IHRvIGJlIGF0dGFjaGVkXHJcbiAgICAgICAgICAgIHdhdGNoVXRpbHMud2hlblRydWVPbmNlKGV2dC5sYXllclZpZXcsIFwiYXR0YWNoZWRcIiwgKCkgPT4gdGhpcy5fY3JlYXRlQ2FudmFzKGV2dC5sYXllclZpZXcpKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2xheWVyVmlldzNkID0gZXZ0LmxheWVyVmlldztcclxuICAgICAgICAgICAgdGhpcy5fY3JlYXRlQ2FudmFzKGV2dC5sYXllclZpZXcpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB3YXRjaFV0aWxzLnBhdXNhYmxlKGV2dC5sYXllclZpZXcudmlldywgXCJzdGF0aW9uYXJ5XCIsIChpc1N0YXRpb25hcnksIGIsIGMsIHZpZXcpID0+IHRoaXMuX3ZpZXdTdGF0aW9uYXJ5KGlzU3RhdGlvbmFyeSwgYiwgYywgdmlldykpO1xyXG5cclxuICAgICAgICBpZiAodGhpcy5yZXBvcnRWYWx1ZXMgPT09IHRydWUpIHtcclxuICAgICAgICAgICAgZXZ0LmxheWVyVmlldy52aWV3Lm9uKFwicG9pbnRlci1tb3ZlXCIsIChldnQpID0+IHRoaXMuX3ZpZXdQb2ludGVyTW92ZShldnQpKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlIG9yIGFzc2lnbiBhIGNhbnZhcyBlbGVtZW50IGZvciB1c2UgaW4gZHJhd2luZy5cclxuICAgICAqIEBwYXJhbSBsYXllclZpZXdcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBfY3JlYXRlQ2FudmFzKGxheWVyVmlldykge1xyXG4gICAgICAgIGlmICh0aGlzLl9pczJkKCkpIHtcclxuICAgICAgICAgICAgLy8gRm9yIGEgbWFwIHZpZXcgZ2V0IHRoZSBjb250YWluZXIgZWxlbWVudCBvZiB0aGUgbGF5ZXIgdmlldyBhbmQgYWRkIGEgY2FudmFzIHRvIGl0LlxyXG4gICAgICAgICAgICB0aGlzLl9jYW52YXMyZCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJjYW52YXNcIik7XHJcbiAgICAgICAgICAgIGxheWVyVmlldy5jb250YWluZXIuZWxlbWVudC5hcHBlbmRDaGlsZCh0aGlzLl9jYW52YXMyZCk7XHJcblxyXG4gICAgICAgICAgICAvLyBkZWZhdWx0IHNvbWUgc3R5bGVzIFxyXG4gICAgICAgICAgICB0aGlzLl9jYW52YXMyZC5zdHlsZS5wb3NpdGlvbiA9IFwiYWJzb2x1dGVcIjtcclxuICAgICAgICAgICAgdGhpcy5fY2FudmFzMmQuc3R5bGUubGVmdCA9IFwiMFwiO1xyXG4gICAgICAgICAgICB0aGlzLl9jYW52YXMyZC5zdHlsZS50b3AgPSBcIjBcIjtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIC8vIEhhbmRsZSBzY2VuZSB2aWV3IGNhbnZhcyBpbiBmdXR1cmUuICAgICAgICAgICAgXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBzZXR1cCB3aW5keSBvbmNlIHRoZSBjYW52YXMgaGFzIGJlZW4gY3JlYXRlZFxyXG4gICAgICAgIHRoaXMuX2luaXRXaW5keSgpO1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICAvKipcclxuICAgICAqIHZpZXcgc3RhdGlvbmFyeSBoYW5kbGVyLCBjbGVhciBjYW52YXMgb3IgZm9yY2UgYSByZWRyYXdcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBfdmlld1N0YXRpb25hcnkoaXNTdGF0aW9uYXJ5LCBiLCBjLCB2aWV3KSB7XHJcbiAgICAgICAgaWYgKCF0aGlzLl9hY3RpdmVWaWV3KSByZXR1cm47XHJcblxyXG4gICAgICAgIGlmICghaXNTdGF0aW9uYXJ5KSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLl93aW5keSkge1xyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2lzMmQoKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3dpbmR5LnN0b3AoKTsgLy8gZm9yY2UgYSBzdG9wIG9mIHdpbmR5IHdoZW4gdmlldyBpcyBtb3ZpbmdcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9jYW52YXMyZC5nZXRDb250ZXh0KFwiMmRcIikuY2xlYXJSZWN0KDAsIDAsIHRoaXMuX2FjdGl2ZVZpZXcud2lkdGgsIHRoaXMuX2FjdGl2ZVZpZXcuaGVpZ2h0KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuX2lzRHJhd2luZykge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fcXVldWVkRHJhdyA9IHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSB7XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZGlzcGxheU9wdGlvbnMucGFydGljbGVNdWx0aXBsaWVyQnlab29tKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2V0UGFydGljbGVNdWx0aXBsaWVyKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgdGhpcy5kcmF3KCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfc2V0UGFydGljbGVNdWx0aXBsaWVyKCkge1xyXG4gICAgICAgIGxldCBjdXJyZW50Wm9vbSA9IHRoaXMuX2FjdGl2ZVZpZXcuem9vbTtcclxuICAgICAgICBsZXQgYmFzZVpvb20gPSB0aGlzLmRpc3BsYXlPcHRpb25zLnBhcnRpY2xlTXVsdGlwbGllckJ5Wm9vbS56b29tTGV2ZWw7XHJcbiAgICAgICAgbGV0IHBtID0gdGhpcy5kaXNwbGF5T3B0aW9ucy5wYXJ0aWNsZU11bHRpcGxpZXJCeVpvb20ucGFydGljbGVNdWx0aXBsaWVyO1xyXG5cclxuICAgICAgICBpZiAoY3VycmVudFpvb20gPiBiYXNlWm9vbSkge1xyXG4gICAgICAgICAgICBsZXQgem9vbURpZmYgPSAoY3VycmVudFpvb20gLSBiYXNlWm9vbSk7XHJcbiAgICAgICAgICAgIHBtID0gdGhpcy5kaXNwbGF5T3B0aW9ucy5wYXJ0aWNsZU11bHRpcGxpZXJCeVpvb20ucGFydGljbGVNdWx0aXBsaWVyIC0gKHpvb21EaWZmICogdGhpcy5kaXNwbGF5T3B0aW9ucy5wYXJ0aWNsZU11bHRpcGxpZXJCeVpvb20uZGlmZlJhdGlvKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSBpZiAoY3VycmVudFpvb20gPCBiYXNlWm9vbSkge1xyXG4gICAgICAgICAgICBsZXQgem9vbURpZmYgPSBiYXNlWm9vbSAtIGN1cnJlbnRab29tO1xyXG4gICAgICAgICAgICBwbSA9IHRoaXMuZGlzcGxheU9wdGlvbnMucGFydGljbGVNdWx0aXBsaWVyQnlab29tLnBhcnRpY2xlTXVsdGlwbGllciArICh6b29tRGlmZiAqIHRoaXMuZGlzcGxheU9wdGlvbnMucGFydGljbGVNdWx0aXBsaWVyQnlab29tLmRpZmZSYXRpbyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAocG0gPCB0aGlzLmRpc3BsYXlPcHRpb25zLnBhcnRpY2xlTXVsdGlwbGllckJ5Wm9vbS5taW5NdWx0aXBsaWVyKSBwbSA9IHRoaXMuZGlzcGxheU9wdGlvbnMucGFydGljbGVNdWx0aXBsaWVyQnlab29tLm1pbk11bHRpcGxpZXI7XHJcbiAgICAgICAgZWxzZSBpZiAocG0gPiB0aGlzLmRpc3BsYXlPcHRpb25zLnBhcnRpY2xlTXVsdGlwbGllckJ5Wm9vbS5tYXhNdWx0aXBsaWVyKSBwbSA9IHRoaXMuZGlzcGxheU9wdGlvbnMucGFydGljbGVNdWx0aXBsaWVyQnlab29tLm1heE11bHRpcGxpZXI7XHJcblxyXG4gICAgICAgIGlmICh0aGlzLl9pczJkKCkgJiYgdGhpcy5fd2luZHkpIHtcclxuICAgICAgICAgICAgdGhpcy5fd2luZHkuUEFSVElDTEVfTVVMVElQTElFUiA9IHBtO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfdmlld1BvaW50ZXJNb3ZlKGV2dCkge1xyXG4gICAgICAgIGlmICghdGhpcy5fd2luZHkgfHwgIXRoaXMudmlzaWJsZSkgcmV0dXJuO1xyXG5cclxuICAgICAgICBsZXQgbW91c2VQb3MgPSB0aGlzLl9nZXRNb3VzZVBvcyhldnQpO1xyXG4gICAgICAgIGxldCBwb2ludCA9IHRoaXMuX2FjdGl2ZVZpZXcudG9NYXAoeyB4OiBtb3VzZVBvcy54LCB5OiBtb3VzZVBvcy55IH0pO1xyXG4gICAgICAgIGlmIChwb2ludC5zcGF0aWFsUmVmZXJlbmNlLmlzV2ViTWVyY2F0b3IpIHtcclxuICAgICAgICAgICAgcG9pbnQgPSA8UG9pbnQ+d2ViTWVyY2F0b3JVdGlscy53ZWJNZXJjYXRvclRvR2VvZ3JhcGhpYyhwb2ludCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgZ3JpZCA9IHRoaXMuX3dpbmR5LmludGVycG9sYXRlKHBvaW50LngsIHBvaW50LnkpO1xyXG4gICAgICAgIGxldCByZXN1bHQ6IFBvaW50UmVwb3J0ID0ge1xyXG4gICAgICAgICAgICBwb2ludDogcG9pbnQsXHJcbiAgICAgICAgICAgIHRhcmdldDogdGhpc1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGlmICghZ3JpZCB8fCAoaXNOYU4oZ3JpZFswXSkgfHwgaXNOYU4oZ3JpZFsxXSkgfHwgIWdyaWRbMl0pKSB7XHJcbiAgICAgICAgICAgIC8vIHRoZSBjdXJyZW50IHBvaW50IGNvbnRhaW5zIG5vIGRhdGEgaW4gdGhlIHdpbmR5IGdyaWQsIHNvIGVtaXQgYW4gb2JqZWN0IHdpdGggbm8gc3BlZWQgb3IgZGlyZWN0aW9uIG9iamVjdFxyXG4gICAgICAgICAgICB0aGlzLmVtaXQoXCJwb2ludC1yZXBvcnRcIiwgcmVzdWx0KTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gZ2V0IHRoZSBzcGVlZCBhbmQgZGlyZWN0aW9uIGFuZCBlbWl0IHRoZSByZXN1bHRcclxuICAgICAgICByZXN1bHQudmVsb2NpdHkgPSB0aGlzLl92ZWN0b3JUb1NwZWVkKGdyaWRbMF0sIGdyaWRbMV0pO1xyXG4gICAgICAgIHJlc3VsdC5kZWdyZWUgPSB0aGlzLl92ZWN0b3JUb0RlZ3JlZXMoZ3JpZFswXSwgZ3JpZFsxXSk7XHJcbiAgICAgICAgdGhpcy5lbWl0KFwicG9pbnQtcmVwb3J0XCIsIHJlc3VsdCk7XHJcblxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ29udmVydCB0aGUgd2luZHkgdmVjdG9yIGRhdGEgdG8gbWV0ZXJzIHBlciBzZWNvbmRcclxuICAgICAqIEBwYXJhbSB1TXNcclxuICAgICAqIEBwYXJhbSB2TXNcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBfdmVjdG9yVG9TcGVlZCh1TXMsIHZNcykge1xyXG4gICAgICAgIGxldCBzcGVlZEFicyA9IE1hdGguc3FydChNYXRoLnBvdyh1TXMsIDIpICsgTWF0aC5wb3codk1zLCAyKSk7XHJcbiAgICAgICAgcmV0dXJuIHNwZWVkQWJzO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmV0dXJuIHRoZSB3aW5keSB2ZWN0b3IgZGF0YSBhcyBhIGRpcmVjdGlvbi4gUmV0dXJucyB0aGUgZGlyZWN0aW9uIG9mIHRoZSBmbG93IG9mIHRoZSBkYXRhIHdpdGggdGhlIGRlZ3JlZXMgaW4gYSBjbG9ja3dpc2UgZGlyZWN0aW9uLlxyXG4gICAgICogQHBhcmFtIHVNc1xyXG4gICAgICogQHBhcmFtIHZNc1xyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF92ZWN0b3JUb0RlZ3JlZXModU1zLCB2TXMpIHtcclxuXHJcbiAgICAgICAgbGV0IGFicyA9IE1hdGguc3FydChNYXRoLnBvdyh1TXMsIDIpICsgTWF0aC5wb3codk1zLCAyKSk7XHJcbiAgICAgICAgbGV0IGRpcmVjdGlvbiA9IE1hdGguYXRhbjIodU1zIC8gYWJzLCB2TXMgLyBhYnMpO1xyXG4gICAgICAgIGxldCBkaXJlY3Rpb25Ub0RlZ3JlZXMgPSBkaXJlY3Rpb24gKiAxODAgLyBNYXRoLlBJICsgMTgwO1xyXG5cclxuICAgICAgICBkaXJlY3Rpb25Ub0RlZ3JlZXMgKz0gMTgwO1xyXG4gICAgICAgIGlmIChkaXJlY3Rpb25Ub0RlZ3JlZXMgPj0gMzYwKSBkaXJlY3Rpb25Ub0RlZ3JlZXMgLT0gMzYwO1xyXG5cclxuICAgICAgICByZXR1cm4gZGlyZWN0aW9uVG9EZWdyZWVzO1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICBwcml2YXRlIF9nZXRNb3VzZVBvcyhldnQpIHtcclxuICAgICAgICAvLyBjb250YWluZXIgb24gdGhlIHZpZXcgaXMgYWN0dWFsbHkgYSBodG1sIGVsZW1lbnQgYXQgdGhpcyBwb2ludCwgbm90IGEgc3RyaW5nIGFzIHRoZSB0eXBpbmdzIHN1Z2dlc3QuXHJcbiAgICAgICAgbGV0IGNvbnRhaW5lcjogYW55ID0gdGhpcy5fYWN0aXZlVmlldy5jb250YWluZXI7XHJcbiAgICAgICAgbGV0IHJlY3QgPSBjb250YWluZXIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgeDogZXZ0LnggLSByZWN0LmxlZnQsXHJcbiAgICAgICAgICAgIHk6IGV2dC55IC0gcmVjdC50b3BcclxuICAgICAgICB9O1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICAvKipcclxuICAgICAqIFdhdGNoIG9mIHRoZSB1cmwgcHJvcGVydHkgLSBjYWxsIGRyYXcgYWdhaW4gd2l0aCBhIHJlZmV0Y2hcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBfdXJsQ2hhbmdlZChhLCBiLCBjLCBkKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuX3dpbmR5KSB0aGlzLl93aW5keS5zdG9wKCk7XHJcbiAgICAgICAgdGhpcy5fZGF0YUZldGNoUmVxdWlyZWQgPSB0cnVlO1xyXG4gICAgICAgIHRoaXMuZHJhdygpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogV2F0Y2ggb2YgdGhlIHVybCBwcm9wZXJ0eSAtIGNhbGwgZHJhdyBhZ2FpbiB3aXRoIGEgcmVmZXRjaFxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF92aXNpYmxlQ2hhbmdlZCh2aXNpYmxlLCBiLCBjLCBkKSB7XHJcbiAgICAgICAgaWYgKCF2aXNpYmxlKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLl93aW5keSkgdGhpcy5fd2luZHkuc3RvcCgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5kcmF3KCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFdhdGNoIG9mIGRpc3BsYXlPcHRpb25zIC0gY2FsbCBkcmF3IGFnYWluIHdpdGggbmV3IG9wdGlvbnMgc2V0IG9uIHdpbmR5LlxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF9kaXNwbGF5T3B0aW9uc0NoYW5nZWQobmV3T3B0aW9ucywgYiwgYywgZCkge1xyXG4gICAgICAgIGlmICghdGhpcy5fd2luZHkpIHJldHVybjtcclxuICAgICAgICB0aGlzLl93aW5keS5zdG9wKCk7XHJcbiAgICAgICAgdGhpcy5fd2luZHkuc2V0RGlzcGxheU9wdGlvbnMobmV3T3B0aW9ucyk7XHJcbiAgICAgICAgdGhpcy5kcmF3KCk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfc2V0RGF0ZSgpIHtcclxuICAgICAgICBpZiAodGhpcy5faXMyZCgpICYmIHRoaXMuX3dpbmR5KSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLl93aW5keS5yZWZUaW1lICYmIHRoaXMuX3dpbmR5LmZvcmVjYXN0VGltZSkge1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIGFzc3VtZSB0aGUgcmVmIHRpbWUgaXMgYW4gaXNvIHN0cmluZywgb3Igc29tZSBvdGhlciBlcXVpdmFsZW50IHRoYXQgamF2YXNjcmlwdCBEYXRlIG9iamVjdCBjYW4gcGFyc2UuXHJcbiAgICAgICAgICAgICAgICBsZXQgZCA9IG5ldyBEYXRlKHRoaXMuX3dpbmR5LnJlZlRpbWUpO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIGFkZCB0aGUgZm9yZWNhc3QgdGltZSBhcyBob3VycyB0byB0aGUgcmVmVGltZTtcclxuICAgICAgICAgICAgICAgIGQuc2V0SG91cnMoZC5nZXRIb3VycygpICsgdGhpcy5fd2luZHkuZm9yZWNhc3RUaW1lKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuZGF0ZSA9IGQ7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuZGF0ZSA9IHVuZGVmaW5lZDtcclxuICAgIH1cclxufVxyXG5cclxuXHJcblxyXG4vKiAgR2xvYmFsIGNsYXNzIGZvciBzaW11bGF0aW5nIHRoZSBtb3ZlbWVudCBvZiBwYXJ0aWNsZSB0aHJvdWdoIGdyaWRcclxuIGNyZWRpdDogQWxsIHRoZSBjcmVkaXQgZm9yIHRoaXMgd29yayBnb2VzIHRvOiBodHRwczovL2dpdGh1Yi5jb20vY2FtYmVjYyBmb3IgY3JlYXRpbmcgdGhlIHJlcG86XHJcbiBodHRwczovL2dpdGh1Yi5jb20vY2FtYmVjYy9lYXJ0aC4gVGhlIG1ham9yaXR5IG9mIHRoaXMgY29kZSBpcyBkaXJlY3RseSB0YWtlbiBmcm9tIHRoZXJlLCBzaW5jZSBpdHMgYXdlc29tZS5cclxuIFRoaXMgY2xhc3MgdGFrZXMgYSBjYW52YXMgZWxlbWVudCBhbmQgYW4gYXJyYXkgb2YgZGF0YSAoMWttIEdGUyBmcm9tIGh0dHA6Ly93d3cuZW1jLm5jZXAubm9hYS5nb3YvaW5kZXgucGhwP2JyYW5jaD1HRlMpXHJcbiBhbmQgdGhlbiB1c2VzIGEgbWVyY2F0b3IgKGZvcndhcmQvcmV2ZXJzZSkgcHJvamVjdGlvbiB0byBjb3JyZWN0bHkgbWFwIHdpbmQgdmVjdG9ycyBpbiBcIm1hcCBzcGFjZVwiLlxyXG4gVGhlIFwic3RhcnRcIiBtZXRob2QgdGFrZXMgdGhlIGJvdW5kcyBvZiB0aGUgbWFwIGF0IGl0cyBjdXJyZW50IGV4dGVudCBhbmQgc3RhcnRzIHRoZSB3aG9sZSBncmlkZGluZyxcclxuIGludGVycG9sYXRpb24gYW5kIGFuaW1hdGlvbiBwcm9jZXNzLlxyXG4gRXh0cmEgY3JlZGl0IHRvIGh0dHBzOi8vZ2l0aHViLmNvbS9kYW53aWxkL2xlYWZsZXQtdmVsb2NpdHkgZm9yIG1vZGlmeWluZyB0aGUgY2xhc3MgdG8gYmUgbW9yZSBjdXN0b21pemFibGUgYW5kIHJldXNhYmxlIGZvciBvdGhlciBzY2VuYXJpb3MuXHJcbiBBbHNvIGNyZWRpdCB0byAtIGh0dHBzOi8vZ2l0aHViLmNvbS9Fc3JpL3dpbmQtanMgXHJcbiAqL1xyXG5jbGFzcyBXaW5keSB7XHJcblxyXG4gICAgTUlOX1ZFTE9DSVRZX0lOVEVOU0lUWTogbnVtYmVyO1xyXG4gICAgTUFYX1ZFTE9DSVRZX0lOVEVOU0lUWTogbnVtYmVyO1xyXG4gICAgVkVMT0NJVFlfU0NBTEU6IG51bWJlcjtcclxuICAgIE1BWF9QQVJUSUNMRV9BR0U6IG51bWJlcjtcclxuICAgIFBBUlRJQ0xFX0xJTkVfV0lEVEg6IG51bWJlcjtcclxuICAgIFBBUlRJQ0xFX01VTFRJUExJRVI6IG51bWJlcjtcclxuICAgIFBBUlRJQ0xFX1JFRFVDVElPTjogbnVtYmVyO1xyXG4gICAgRlJBTUVfUkFURTogbnVtYmVyO1xyXG4gICAgRlJBTUVfVElNRTogbnVtYmVyO1xyXG4gICAgY29sb3JTY2FsZTogYW55O1xyXG4gICAgY2FudmFzOiBIVE1MQ2FudmFzRWxlbWVudDtcclxuXHJcbiAgICBmb3JlY2FzdFRpbWU6IG51bWJlcjtcclxuICAgIHJlZlRpbWU6IHN0cmluZztcclxuXHJcbiAgICBOVUxMX1dJTkRfVkVDVE9SID0gW05hTiwgTmFOLCBudWxsXTsgLy8gc2luZ2xldG9uIGZvciBubyB3aW5kIGluIHRoZSBmb3JtOiBbdSwgdiwgbWFnbml0dWRlXVxyXG5cclxuICAgIHN0YXRpYyBmaWVsZDogYW55O1xyXG4gICAgc3RhdGljIGFuaW1hdGlvbkxvb3A7XHJcblxyXG4gICAgYnVpbGRlcjtcclxuICAgIGdyaWQ7XHJcbiAgICBncmlkRGF0YTogYW55O1xyXG4gICAgZGF0ZTtcclxuICAgIM67MDtcclxuICAgIM+GMDtcclxuICAgIM6Uzrs7XHJcbiAgICDOlM+GO1xyXG4gICAgbmk7XHJcbiAgICBuajtcclxuXHJcbiAgICBwcml2YXRlIF9zY2FuTW9kZTogbnVtYmVyO1xyXG4gICAgcHJpdmF0ZSBfZHluYW1pY1BhcnRpY2xlTXVsdGlwbGllcjogYm9vbGVhbjtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihjYW52YXM6IEhUTUxDYW52YXNFbGVtZW50LCBkYXRhPzogYW55LCBvcHRpb25zPzogRGlzcGxheU9wdGlvbnMpIHtcclxuXHJcbiAgICAgICAgdGhpcy5jYW52YXMgPSBjYW52YXM7XHJcbiAgICAgICAgaWYgKCFvcHRpb25zKSBvcHRpb25zID0ge307XHJcbiAgICAgICAgdGhpcy5zZXREaXNwbGF5T3B0aW9ucyhvcHRpb25zKTtcclxuICAgICAgICB0aGlzLmdyaWREYXRhID0gZGF0YTtcclxuXHJcbiAgICB9XHJcblxyXG4gICAgc2V0RGF0YShkYXRhKSB7XHJcbiAgICAgICAgdGhpcy5ncmlkRGF0YSA9IGRhdGE7XHJcbiAgICB9XHJcblxyXG4gICAgc2V0RGlzcGxheU9wdGlvbnMob3B0aW9uczogRGlzcGxheU9wdGlvbnMpIHtcclxuICAgICAgICB0aGlzLk1JTl9WRUxPQ0lUWV9JTlRFTlNJVFkgPSBvcHRpb25zLm1pblZlbG9jaXR5IHx8IDA7IC8vIHZlbG9jaXR5IGF0IHdoaWNoIHBhcnRpY2xlIGludGVuc2l0eSBpcyBtaW5pbXVtIChtL3MpXHJcbiAgICAgICAgdGhpcy5NQVhfVkVMT0NJVFlfSU5URU5TSVRZID0gb3B0aW9ucy5tYXhWZWxvY2l0eSB8fCAxMDsgLy8gdmVsb2NpdHkgYXQgd2hpY2ggcGFydGljbGUgaW50ZW5zaXR5IGlzIG1heGltdW0gKG0vcylcclxuICAgICAgICB0aGlzLlZFTE9DSVRZX1NDQUxFID0gKG9wdGlvbnMudmVsb2NpdHlTY2FsZSB8fCAwLjAwNSkgKiAoTWF0aC5wb3cod2luZG93LmRldmljZVBpeGVsUmF0aW8sIDEgLyAzKSB8fCAxKTsgLy8gc2NhbGUgZm9yIHdpbmQgdmVsb2NpdHkgKGNvbXBsZXRlbHkgYXJiaXRyYXJ5LS10aGlzIHZhbHVlIGxvb2tzIG5pY2UpXHJcbiAgICAgICAgdGhpcy5NQVhfUEFSVElDTEVfQUdFID0gb3B0aW9ucy5wYXJ0aWNsZUFnZSB8fCA5MDsgLy8gbWF4IG51bWJlciBvZiBmcmFtZXMgYSBwYXJ0aWNsZSBpcyBkcmF3biBiZWZvcmUgcmVnZW5lcmF0aW9uXHJcbiAgICAgICAgdGhpcy5QQVJUSUNMRV9MSU5FX1dJRFRIID0gb3B0aW9ucy5saW5lV2lkdGggfHwgMTsgLy8gbGluZSB3aWR0aCBvZiBhIGRyYXduIHBhcnRpY2xlXHJcblxyXG4gICAgICAgIC8vIGRlZmF1bHQgcGFydGljbGUgbXVsdGlwbGllciB0byAyXHJcbiAgICAgICAgdGhpcy5QQVJUSUNMRV9NVUxUSVBMSUVSID0gb3B0aW9ucy5wYXJ0aWNsZU11bHRpcGxpZXIgfHwgMjtcclxuXHJcbiAgICAgICAgdGhpcy5QQVJUSUNMRV9SRURVQ1RJT04gPSBNYXRoLnBvdyh3aW5kb3cuZGV2aWNlUGl4ZWxSYXRpbywgMSAvIDMpIHx8IDEuNjsgLy8gbXVsdGlwbHkgcGFydGljbGUgY291bnQgZm9yIG1vYmlsZXMgYnkgdGhpcyBhbW91bnRcclxuICAgICAgICB0aGlzLkZSQU1FX1JBVEUgPSBvcHRpb25zLmZyYW1lUmF0ZSB8fCAxNTtcclxuICAgICAgICB0aGlzLkZSQU1FX1RJTUUgPSAxMDAwIC8gdGhpcy5GUkFNRV9SQVRFOyAvLyBkZXNpcmVkIGZyYW1lcyBwZXIgc2Vjb25kXHJcblxyXG4gICAgICAgIHZhciBkZWZhdWx0Q29sb3JTY2FsZSA9IFtcInJnYig2MSwxNjAsMjQ3KVwiLCBcInJnYig5OSwxNjQsMjE3KVwiLCBcInJnYigxMzgsMTY4LDE4OClcIiwgXCJyZ2IoMTc3LDE3MywxNTgpXCIsIFwicmdiKDIxNiwxNzcsMTI5KVwiLCBcInJnYigyNTUsMTgyLDEwMClcIiwgXCJyZ2IoMjQwLDE0NSw4NylcIiwgXCJyZ2IoMjI1LDEwOSw3NClcIiwgXCJyZ2IoMjEwLDcyLDYxKVwiLCBcInJnYigxOTUsMzYsNDgpXCIsIFwicmdiKDE4MCwwLDM1KVwiXTtcclxuICAgICAgICB0aGlzLmNvbG9yU2NhbGUgPSBvcHRpb25zLmNvbG9yU2NhbGUgfHwgZGVmYXVsdENvbG9yU2NhbGU7XHJcbiAgICB9XHJcblxyXG4gICAgc3RhcnQoYm91bmRzLCB3aWR0aCwgaGVpZ2h0LCBleHRlbnQpIHtcclxuXHJcbiAgICAgICAgbGV0IG1hcEJvdW5kcyA9IHtcclxuICAgICAgICAgICAgc291dGg6IHRoaXMuZGVnMnJhZChleHRlbnRbMF1bMV0pLFxyXG4gICAgICAgICAgICBub3J0aDogdGhpcy5kZWcycmFkKGV4dGVudFsxXVsxXSksXHJcbiAgICAgICAgICAgIGVhc3Q6IHRoaXMuZGVnMnJhZChleHRlbnRbMV1bMF0pLFxyXG4gICAgICAgICAgICB3ZXN0OiB0aGlzLmRlZzJyYWQoZXh0ZW50WzBdWzBdKSxcclxuICAgICAgICAgICAgd2lkdGg6IHdpZHRoLFxyXG4gICAgICAgICAgICBoZWlnaHQ6IGhlaWdodFxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHRoaXMuc3RvcCgpO1xyXG5cclxuICAgICAgICAvLyBidWlsZCBncmlkXHJcbiAgICAgICAgdGhpcy5idWlsZEdyaWQodGhpcy5ncmlkRGF0YSwgKGdyaWRSZXN1bHQpID0+IHtcclxuICAgICAgICAgICAgbGV0IGJ1aWx0Qm91bmRzID0gdGhpcy5idWlsZEJvdW5kcyhib3VuZHMsIHdpZHRoLCBoZWlnaHQpO1xyXG4gICAgICAgICAgICB0aGlzLmludGVycG9sYXRlRmllbGQoZ3JpZFJlc3VsdCwgYnVpbHRCb3VuZHMsIG1hcEJvdW5kcywgKGJvdW5kcywgZmllbGQpID0+IHtcclxuICAgICAgICAgICAgICAgIC8vIGFuaW1hdGUgdGhlIGNhbnZhcyB3aXRoIHJhbmRvbSBwb2ludHNcclxuICAgICAgICAgICAgICAgIFdpbmR5LmZpZWxkID0gZmllbGQ7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFuaW1hdGUoYm91bmRzLCBXaW5keS5maWVsZCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIHN0b3AoKSB7XHJcbiAgICAgICAgaWYgKFdpbmR5LmZpZWxkKSBXaW5keS5maWVsZC5yZWxlYXNlKCk7XHJcbiAgICAgICAgaWYgKFdpbmR5LmFuaW1hdGlvbkxvb3ApIGNhbmNlbEFuaW1hdGlvbkZyYW1lKFdpbmR5LmFuaW1hdGlvbkxvb3ApO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgKiBHZXQgaW50ZXJwb2xhdGVkIGdyaWQgdmFsdWUgZnJvbSBMb24vTGF0IHBvc2l0aW9uXHJcbiAgICogQHBhcmFtIM67IHtGbG9hdH0gTG9uZ2l0dWRlXHJcbiAgICogQHBhcmFtIM+GIHtGbG9hdH0gTGF0aXR1ZGVcclxuICAgKiBAcmV0dXJucyB7T2JqZWN0fVxyXG4gICAqL1xyXG4gICAgaW50ZXJwb2xhdGUozrssIM+GKSB7XHJcblxyXG4gICAgICAgIGlmICghdGhpcy5ncmlkKSByZXR1cm4gbnVsbDtcclxuXHJcbiAgICAgICAgbGV0IGkgPSB0aGlzLmZsb29yTW9kKM67IC0gdGhpcy7OuzAsIDM2MCkgLyB0aGlzLs6Uzrs7IC8vIGNhbGN1bGF0ZSBsb25naXR1ZGUgaW5kZXggaW4gd3JhcHBlZCByYW5nZSBbMCwgMzYwKVxyXG4gICAgICAgIGxldCBqID0gKHRoaXMuz4YwIC0gz4YpIC8gdGhpcy7OlM+GOyAvLyBjYWxjdWxhdGUgbGF0aXR1ZGUgaW5kZXggaW4gZGlyZWN0aW9uICs5MCB0byAtOTBcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuX3NjYW5Nb2RlID09PSA2NCkge1xyXG4gICAgICAgICAgICAvLyBjYWxjdWxhdGUgbGF0aXR1ZGUgaW5kZXggaW4gZGlyZWN0aW9uIC05MCB0byArOTAgYXMgdGhpcyBpcyBzY2FuIG1vZGUgNjRcclxuICAgICAgICAgICAgaiA9ICjPhiAtIHRoaXMuz4YwKSAvIHRoaXMuzpTPhjtcclxuICAgICAgICAgICAgaiA9IHRoaXMuZ3JpZC5sZW5ndGggLSBqO1xyXG4gICAgICAgIH1cclxuXHJcblxyXG4gICAgICAgIGxldCBmaSA9IE1hdGguZmxvb3IoaSksXHJcbiAgICAgICAgICAgIGNpID0gZmkgKyAxO1xyXG4gICAgICAgIGxldCBmaiA9IE1hdGguZmxvb3IoaiksXHJcbiAgICAgICAgICAgIGNqID0gZmogKyAxO1xyXG5cclxuICAgICAgICBsZXQgcm93O1xyXG4gICAgICAgIGlmIChyb3cgPSB0aGlzLmdyaWRbZmpdKSB7XHJcbiAgICAgICAgICAgIHZhciBnMDAgPSByb3dbZmldO1xyXG4gICAgICAgICAgICB2YXIgZzEwID0gcm93W2NpXTtcclxuICAgICAgICAgICAgaWYgKHRoaXMuaXNWYWx1ZShnMDApICYmIHRoaXMuaXNWYWx1ZShnMTApICYmIChyb3cgPSB0aGlzLmdyaWRbY2pdKSkge1xyXG4gICAgICAgICAgICAgICAgdmFyIGcwMSA9IHJvd1tmaV07XHJcbiAgICAgICAgICAgICAgICB2YXIgZzExID0gcm93W2NpXTtcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmlzVmFsdWUoZzAxKSAmJiB0aGlzLmlzVmFsdWUoZzExKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIEFsbCBmb3VyIHBvaW50cyBmb3VuZCwgc28gaW50ZXJwb2xhdGUgdGhlIHZhbHVlLlxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmJ1aWxkZXIuaW50ZXJwb2xhdGUoaSAtIGZpLCBqIC0gZmosIGcwMCwgZzEwLCBnMDEsIGcxMSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBidWlsZEdyaWQoZGF0YSwgY2FsbGJhY2spIHtcclxuXHJcbiAgICAgICAgdGhpcy5idWlsZGVyID0gdGhpcy5jcmVhdGVCdWlsZGVyKGRhdGEpO1xyXG4gICAgICAgIHZhciBoZWFkZXIgPSB0aGlzLmJ1aWxkZXIuaGVhZGVyO1xyXG5cclxuICAgICAgICB0aGlzLs67MCA9IGhlYWRlci5sbzE7XHJcbiAgICAgICAgdGhpcy7PhjAgPSBoZWFkZXIubGExOyAvLyB0aGUgZ3JpZCdzIG9yaWdpbiAoZS5nLiwgMC4wRSwgOTAuME4pXHJcblxyXG4gICAgICAgIHRoaXMuzpTOuyA9IGhlYWRlci5keDtcclxuICAgICAgICB0aGlzLs6Uz4YgPSBoZWFkZXIuZHk7IC8vIGRpc3RhbmNlIGJldHdlZW4gZ3JpZCBwb2ludHMgKGUuZy4sIDIuNSBkZWcgbG9uLCAyLjUgZGVnIGxhdClcclxuXHJcbiAgICAgICAgdGhpcy5uaSA9IGhlYWRlci5ueDtcclxuICAgICAgICB0aGlzLm5qID0gaGVhZGVyLm55OyAvLyBudW1iZXIgb2YgZ3JpZCBwb2ludHMgVy1FIGFuZCBOLVMgKGUuZy4sIDE0NCB4IDczKVxyXG5cclxuICAgICAgICB0aGlzLmRhdGUgPSBuZXcgRGF0ZShoZWFkZXIucmVmVGltZSk7XHJcbiAgICAgICAgdGhpcy5kYXRlLnNldEhvdXJzKHRoaXMuZGF0ZS5nZXRIb3VycygpICsgaGVhZGVyLmZvcmVjYXN0VGltZSk7XHJcblxyXG4gICAgICAgIHRoaXMuX3NjYW5Nb2RlID0gaGVhZGVyLnNjYW5Nb2RlO1xyXG5cclxuICAgICAgICB0aGlzLmdyaWQgPSBbXTtcclxuICAgICAgICB2YXIgcCA9IDA7XHJcbiAgICAgICAgdmFyIGlzQ29udGludW91cyA9IE1hdGguZmxvb3IodGhpcy5uaSAqIHRoaXMuzpTOuykgPj0gMzYwO1xyXG5cclxuICAgICAgICBpZiAoaGVhZGVyLnNjYW5Nb2RlID09PSAwKSB7XHJcbiAgICAgICAgICAgIC8vIFNjYW4gbW9kZSAwLiBMb25naXR1ZGUgaW5jcmVhc2VzIGZyb20gzrswLCBhbmQgbGF0aXR1ZGUgZGVjcmVhc2VzIGZyb20gz4YwLlxyXG4gICAgICAgICAgICAvLyBodHRwOi8vd3d3Lm5jby5uY2VwLm5vYWEuZ292L3BtYi9kb2NzL2dyaWIyL2dyaWIyX3RhYmxlMy00LnNodG1sXHJcblxyXG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHRoaXMubmo7IGorKykge1xyXG4gICAgICAgICAgICAgICAgbGV0IHJvdyA9IFtdO1xyXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLm5pOyBpKysgLCBwKyspIHtcclxuICAgICAgICAgICAgICAgICAgICByb3dbaV0gPSB0aGlzLmJ1aWxkZXIuZGF0YShwKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGlmIChpc0NvbnRpbnVvdXMpIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBGb3Igd3JhcHBlZCBncmlkcywgZHVwbGljYXRlIGZpcnN0IGNvbHVtbiBhcyBsYXN0IGNvbHVtbiB0byBzaW1wbGlmeSBpbnRlcnBvbGF0aW9uIGxvZ2ljXHJcbiAgICAgICAgICAgICAgICAgICAgcm93LnB1c2gocm93WzBdKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHRoaXMuZ3JpZFtqXSA9IHJvdztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIGlmIChoZWFkZXIuc2Nhbk1vZGUgPT09IDY0KSB7XHJcbiAgICAgICAgICAgIC8vIFNjYW4gbW9kZSA2NC4gTG9uZ2l0dWRlIGluY3JlYXNlcyBmcm9tIM67MCwgYW5kIGxhdGl0dWRlIGluY3JlYXNlcyBmcm9tIM+GMC5cclxuICAgICAgICAgICAgZm9yIChsZXQgaiA9IHRoaXMubmogLSAxOyBqID49IDA7IGotLSkge1xyXG4gICAgICAgICAgICAgICAgbGV0IHJvdyA9IFtdO1xyXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLm5pOyBpKysgLCBwKyspIHtcclxuICAgICAgICAgICAgICAgICAgICByb3dbaV0gPSB0aGlzLmJ1aWxkZXIuZGF0YShwKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGlmIChpc0NvbnRpbnVvdXMpIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBGb3Igd3JhcHBlZCBncmlkcywgZHVwbGljYXRlIGZpcnN0IGNvbHVtbiBhcyBsYXN0IGNvbHVtbiB0byBzaW1wbGlmeSBpbnRlcnBvbGF0aW9uIGxvZ2ljXHJcbiAgICAgICAgICAgICAgICAgICAgcm93LnB1c2gocm93WzBdKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHRoaXMuZ3JpZFtqXSA9IHJvdztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY2FsbGJhY2soe1xyXG4gICAgICAgICAgICBkYXRlOiB0aGlzLmRhdGUsXHJcbiAgICAgICAgICAgIGludGVycG9sYXRlOiB0aGlzLmludGVycG9sYXRlXHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBjcmVhdGVCdWlsZGVyKGRhdGEpIHtcclxuICAgICAgICBsZXQgdUNvbXAgPSBudWxsLFxyXG4gICAgICAgICAgICB2Q29tcCA9IG51bGwsXHJcbiAgICAgICAgICAgIHNjYWxhciA9IG51bGwsXHJcbiAgICAgICAgICAgIGRpcmVjdGlvblRydWUgPSBudWxsLFxyXG4gICAgICAgICAgICBtYWduaXR1ZGUgPSBudWxsO1xyXG5cclxuICAgICAgICBsZXQgc3VwcG9ydGVkID0gdHJ1ZTtcclxuICAgICAgICBsZXQgaGVhZGVyRmllbGRzO1xyXG5cclxuICAgICAgICBkYXRhLmZvckVhY2goKHJlY29yZCkgPT4ge1xyXG4gICAgICAgICAgICBoZWFkZXJGaWVsZHMgPSBgJHtyZWNvcmQuaGVhZGVyLmRpc2NpcGxpbmV9LCR7cmVjb3JkLmhlYWRlci5wYXJhbWV0ZXJDYXRlZ29yeX0sJHtyZWNvcmQuaGVhZGVyLnBhcmFtZXRlck51bWJlcn1gO1xyXG4gICAgICAgICAgICBzd2l0Y2ggKGhlYWRlckZpZWxkcykge1xyXG4gICAgICAgICAgICAgICAgY2FzZSBcIjAsMSwyXCI6XHJcbiAgICAgICAgICAgICAgICBjYXNlIFwiMCwyLDJcIjpcclxuICAgICAgICAgICAgICAgICAgICB1Q29tcCA9IHJlY29yZDsgLy8gdGhpcyBpcyBtZXRlb3JvbG9naWNhbCBjb21wb25lbnQgd2l0aCB1IGFuZCB2LlxyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgY2FzZSBcIjAsMSwzXCI6XHJcbiAgICAgICAgICAgICAgICBjYXNlIFwiMCwyLDNcIjpcclxuICAgICAgICAgICAgICAgICAgICB2Q29tcCA9IHJlY29yZDsgLy8gdGhpcyBpcyBtZXRlb3JvbG9naWNhbCBjb21wb25lbnQgd2l0aCB1IGFuZCB2LlxyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgY2FzZSBcIjEwLDAsN1wiOlxyXG4gICAgICAgICAgICAgICAgY2FzZSBcIjEwLDAsMTBcIjpcclxuICAgICAgICAgICAgICAgIGNhc2UgXCIwLDIsMFwiOlxyXG4gICAgICAgICAgICAgICAgICAgIGRpcmVjdGlvblRydWUgPSByZWNvcmQ7IC8vd2F2ZXMgYW5kIHdpbmQgZGlyZWN0aW9uXHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICBjYXNlIFwiMTAsMCw4XCI6IFxyXG4gICAgICAgICAgICAgICAgY2FzZSBcIjEwLDAsM1wiOlxyXG4gICAgICAgICAgICAgICAgY2FzZSBcIjAsMiwxXCI6IFxyXG4gICAgICAgICAgICAgICAgICAgIG1hZ25pdHVkZSA9IHJlY29yZDsgLy93YXZlcyBhbmQgd2luZCBoZWlnaHRcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICAgICAgc3VwcG9ydGVkID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyBqdXN0IHRha2UgdGhlIGxhc3QgcmVjb3JkcyByZWZ0aW1lIGFuZCBmb3JlY2FzdCB0aW1lIGFzIHRoZSBvbmUgd2UncmUgdXNpbmdcclxuICAgICAgICAgICAgdGhpcy5yZWZUaW1lID0gcmVjb3JkLmhlYWRlci5yZWZUaW1lO1xyXG4gICAgICAgICAgICB0aGlzLmZvcmVjYXN0VGltZSA9IHJlY29yZC5oZWFkZXIuZm9yZWNhc3RUaW1lO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBpZiAoIXN1cHBvcnRlZCkge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiV2luZHkgZG9lc24ndCBzdXBwb3J0IGRpc2NpcGxpbmUsIGNhdGVnb3J5IGFuZCBudW1iZXIgY29tYmluYXRpb24uIFwiICsgaGVhZGVyRmllbGRzKTtcclxuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgICAgICB9XHJcblxyXG5cclxuICAgICAgICBpZiAoZGlyZWN0aW9uVHJ1ZSAmJiBtYWduaXR1ZGUpIHtcclxuICAgICAgICAgICAgLy8gSWYgZGF0YSBjb250YWlucyBhIGRpcmVjdGlvbiBhbmQgbWFnbml0dWRlIGNvbnZlcnQgaXQgdG8gYSB1IGFuZCB2LlxyXG4gICAgICAgICAgICB1Q29tcCA9IHt9O1xyXG4gICAgICAgICAgICB1Q29tcC5oZWFkZXIgPSBkaXJlY3Rpb25UcnVlLmhlYWRlcjtcclxuICAgICAgICAgICAgdkNvbXAgPSB7fTtcclxuICAgICAgICAgICAgdkNvbXAuaGVhZGVyID0gZGlyZWN0aW9uVHJ1ZS5oZWFkZXI7XHJcbiAgICAgICAgICAgIHVDb21wLmRhdGEgPSBbXTtcclxuICAgICAgICAgICAgdkNvbXAuZGF0YSA9IFtdO1xyXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gZGlyZWN0aW9uVHJ1ZS5kYXRhLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcblxyXG4gICAgICAgICAgICAgICAgbGV0IGRpciA9IGRpcmVjdGlvblRydWUuZGF0YVtpXTtcclxuICAgICAgICAgICAgICAgIGxldCBtYWcgPSBtYWduaXR1ZGUuZGF0YVtpXTtcclxuXHJcbiAgICAgICAgICAgICAgICBpZiAoKCFkaXIgfHwgaXNOYU4oZGlyKSkgfHwgKCFtYWcgfHwgaXNOYU4obWFnKSkpIHtcclxuICAgICAgICAgICAgICAgICAgICB2Q29tcFtpXSA9IG51bGw7XHJcbiAgICAgICAgICAgICAgICAgICAgdUNvbXBbaV0gPSBudWxsO1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIGxldCBwaGkgPSBkaXIgKiBNYXRoLlBJIC8gMTgwO1xyXG4gICAgICAgICAgICAgICAgbGV0IHUgPSAtbWFnICogTWF0aC5zaW4ocGhpKTtcclxuICAgICAgICAgICAgICAgIGxldCB2ID0gLW1hZyAqIE1hdGguY29zKHBoaSk7XHJcblxyXG4gICAgICAgICAgICAgICAgdUNvbXAuZGF0YVtpXSA9IHU7XHJcbiAgICAgICAgICAgICAgICB2Q29tcC5kYXRhW2ldID0gdjtcclxuXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG5cclxuICAgICAgICByZXR1cm4gdGhpcy5jcmVhdGVXaW5kQnVpbGRlcih1Q29tcCwgdkNvbXApO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgY3JlYXRlV2luZEJ1aWxkZXIodUNvbXAsIHZDb21wKSB7XHJcbiAgICAgICAgbGV0IHVEYXRhID0gdUNvbXAuZGF0YSxcclxuICAgICAgICAgICAgdkRhdGEgPSB2Q29tcC5kYXRhO1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIGhlYWRlcjogdUNvbXAuaGVhZGVyLFxyXG4gICAgICAgICAgICBkYXRhOiBmdW5jdGlvbiBkYXRhKGkpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBbdURhdGFbaV0sIHZEYXRhW2ldXTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgaW50ZXJwb2xhdGU6IHRoaXMuYmlsaW5lYXJJbnRlcnBvbGF0ZVZlY3RvclxyXG4gICAgICAgIH07XHJcbiAgICB9XHJcblxyXG5cclxuICAgIHByaXZhdGUgYnVpbGRCb3VuZHMoYm91bmRzLCB3aWR0aCwgaGVpZ2h0KSB7XHJcbiAgICAgICAgbGV0IHVwcGVyTGVmdCA9IGJvdW5kc1swXTtcclxuICAgICAgICBsZXQgbG93ZXJSaWdodCA9IGJvdW5kc1sxXTtcclxuICAgICAgICBsZXQgeCA9IE1hdGgucm91bmQodXBwZXJMZWZ0WzBdKTtcclxuICAgICAgICBsZXQgeSA9IE1hdGgubWF4KE1hdGguZmxvb3IodXBwZXJMZWZ0WzFdKSwgMCk7XHJcbiAgICAgICAgbGV0IHhNYXggPSBNYXRoLm1pbihNYXRoLmNlaWwobG93ZXJSaWdodFswXSksIHdpZHRoIC0gMSk7XHJcbiAgICAgICAgbGV0IHlNYXggPSBNYXRoLm1pbihNYXRoLmNlaWwobG93ZXJSaWdodFsxXSksIGhlaWdodCAtIDEpO1xyXG4gICAgICAgIHJldHVybiB7IHg6IHgsIHk6IHksIHhNYXg6IHdpZHRoLCB5TWF4OiB5TWF4LCB3aWR0aDogd2lkdGgsIGhlaWdodDogaGVpZ2h0IH07XHJcbiAgICB9XHJcblxyXG5cclxuICAgIC8vIGludGVycG9sYXRpb24gZm9yIHZlY3RvcnMgbGlrZSB3aW5kICh1LHYsbSlcclxuICAgIHByaXZhdGUgYmlsaW5lYXJJbnRlcnBvbGF0ZVZlY3Rvcih4LCB5LCBnMDAsIGcxMCwgZzAxLCBnMTEpIHtcclxuICAgICAgICBsZXQgcnggPSAxIC0geDtcclxuICAgICAgICBsZXQgcnkgPSAxIC0geTtcclxuICAgICAgICBsZXQgYSA9IHJ4ICogcnksXHJcbiAgICAgICAgICAgIGIgPSB4ICogcnksXHJcbiAgICAgICAgICAgIGMgPSByeCAqIHksXHJcbiAgICAgICAgICAgIGQgPSB4ICogeTtcclxuICAgICAgICBsZXQgdSA9IGcwMFswXSAqIGEgKyBnMTBbMF0gKiBiICsgZzAxWzBdICogYyArIGcxMVswXSAqIGQ7XHJcbiAgICAgICAgbGV0IHYgPSBnMDBbMV0gKiBhICsgZzEwWzFdICogYiArIGcwMVsxXSAqIGMgKyBnMTFbMV0gKiBkO1xyXG4gICAgICAgIHJldHVybiBbdSwgdiwgTWF0aC5zcXJ0KHUgKiB1ICsgdiAqIHYpXTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGRlZzJyYWQoZGVnKSB7XHJcbiAgICAgICAgcmV0dXJuIGRlZyAvIDE4MCAqIE1hdGguUEk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSByYWQyZGVnKGFuZykge1xyXG4gICAgICAgIHJldHVybiBhbmcgLyAoTWF0aC5QSSAvIDE4MC4wKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICogQHJldHVybnMge0Jvb2xlYW59IHRydWUgaWYgdGhlIHNwZWNpZmllZCB2YWx1ZSBpcyBub3QgbnVsbCBhbmQgbm90IHVuZGVmaW5lZC5cclxuICAgICovXHJcbiAgICBwcml2YXRlIGlzVmFsdWUoeCkge1xyXG4gICAgICAgIHJldHVybiB4ICE9PSBudWxsICYmIHggIT09IHVuZGVmaW5lZDtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICogQHJldHVybnMge051bWJlcn0gcmV0dXJucyByZW1haW5kZXIgb2YgZmxvb3JlZCBkaXZpc2lvbiwgaS5lLiwgZmxvb3IoYSAvIG4pLiBVc2VmdWwgZm9yIGNvbnNpc3RlbnQgbW9kdWxvXHJcbiAgICAqICAgICAgICAgIG9mIG5lZ2F0aXZlIG51bWJlcnMuIFNlZSBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL01vZHVsb19vcGVyYXRpb24uXHJcbiAgICAqL1xyXG4gICAgcHJpdmF0ZSBmbG9vck1vZChhLCBuKSB7XHJcbiAgICAgICAgcmV0dXJuIGEgLSBuICogTWF0aC5mbG9vcihhIC8gbik7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAqIEByZXR1cm5zIHtOdW1iZXJ9IHRoZSB2YWx1ZSB4IGNsYW1wZWQgdG8gdGhlIHJhbmdlIFtsb3csIGhpZ2hdLlxyXG4gICAgKi9cclxuICAgIHByaXZhdGUgY2xhbXAoeCwgcmFuZ2UpIHtcclxuICAgICAgICByZXR1cm4gTWF0aC5tYXgocmFuZ2VbMF0sIE1hdGgubWluKHgsIHJhbmdlWzFdKSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAqIEByZXR1cm5zIHtCb29sZWFufSB0cnVlIGlmIGFnZW50IGlzIHByb2JhYmx5IGEgbW9iaWxlIGRldmljZS4gRG9uJ3QgcmVhbGx5IGNhcmUgaWYgdGhpcyBpcyBhY2N1cmF0ZS5cclxuICAgICovXHJcbiAgICBwcml2YXRlIGlzTW9iaWxlKCkge1xyXG4gICAgICAgIHJldHVybiAoL2FuZHJvaWR8YmxhY2tiZXJyeXxpZW1vYmlsZXxpcGFkfGlwaG9uZXxpcG9kfG9wZXJhIG1pbml8d2Vib3MvaS50ZXN0KG5hdmlnYXRvci51c2VyQWdlbnQpKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICogQ2FsY3VsYXRlIGRpc3RvcnRpb24gb2YgdGhlIHdpbmQgdmVjdG9yIGNhdXNlZCBieSB0aGUgc2hhcGUgb2YgdGhlIHByb2plY3Rpb24gYXQgcG9pbnQgKHgsIHkpLiBUaGUgd2luZFxyXG4gICAgKiB2ZWN0b3IgaXMgbW9kaWZpZWQgaW4gcGxhY2UgYW5kIHJldHVybmVkIGJ5IHRoaXMgZnVuY3Rpb24uXHJcbiAgICAqL1xyXG4gICAgcHJpdmF0ZSBkaXN0b3J0KHByb2plY3Rpb24sIM67LCDPhiwgeCwgeSwgc2NhbGUsIHdpbmQsIHdpbmR5KSB7XHJcbiAgICAgICAgdmFyIHUgPSB3aW5kWzBdICogc2NhbGU7XHJcbiAgICAgICAgdmFyIHYgPSB3aW5kWzFdICogc2NhbGU7XHJcbiAgICAgICAgdmFyIGQgPSB0aGlzLmRpc3RvcnRpb24ocHJvamVjdGlvbiwgzrssIM+GLCB4LCB5LCB3aW5keSk7XHJcblxyXG4gICAgICAgIC8vIFNjYWxlIGRpc3RvcnRpb24gdmVjdG9ycyBieSB1IGFuZCB2LCB0aGVuIGFkZC5cclxuICAgICAgICB3aW5kWzBdID0gZFswXSAqIHUgKyBkWzJdICogdjtcclxuICAgICAgICB3aW5kWzFdID0gZFsxXSAqIHUgKyBkWzNdICogdjtcclxuICAgICAgICByZXR1cm4gd2luZDtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGRpc3RvcnRpb24ocHJvamVjdGlvbiwgzrssIM+GLCB4LCB5LCB3aW5keSkge1xyXG4gICAgICAgIGxldCDPhCA9IDIgKiBNYXRoLlBJO1xyXG4gICAgICAgIGxldCBIID0gTWF0aC5wb3coMTAsIC01LjIpO1xyXG4gICAgICAgIGxldCBozrsgPSDOuyA8IDAgPyBIIDogLUg7XHJcbiAgICAgICAgbGV0IGjPhiA9IM+GIDwgMCA/IEggOiAtSDtcclxuXHJcbiAgICAgICAgbGV0IHDOuyA9IHRoaXMucHJvamVjdCjPhiwgzrsgKyBozrssIHdpbmR5KTtcclxuICAgICAgICBsZXQgcM+GID0gdGhpcy5wcm9qZWN0KM+GICsgaM+GLCDOuywgd2luZHkpO1xyXG5cclxuICAgICAgICAvLyBNZXJpZGlhbiBzY2FsZSBmYWN0b3IgKHNlZSBTbnlkZXIsIGVxdWF0aW9uIDQtMyksIHdoZXJlIFIgPSAxLiBUaGlzIGhhbmRsZXMgaXNzdWUgd2hlcmUgbGVuZ3RoIG9mIDHCuiDOu1xyXG4gICAgICAgIC8vIGNoYW5nZXMgZGVwZW5kaW5nIG9uIM+GLiBXaXRob3V0IHRoaXMsIHRoZXJlIGlzIGEgcGluY2hpbmcgZWZmZWN0IGF0IHRoZSBwb2xlcy5cclxuICAgICAgICBsZXQgayA9IE1hdGguY29zKM+GIC8gMzYwICogz4QpO1xyXG4gICAgICAgIHJldHVybiBbKHDOu1swXSAtIHgpIC8gaM67IC8gaywgKHDOu1sxXSAtIHkpIC8gaM67IC8gaywgKHDPhlswXSAtIHgpIC8gaM+GLCAocM+GWzFdIC0geSkgLyBoz4ZdO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgbWVyY1kobGF0KSB7XHJcbiAgICAgICAgcmV0dXJuIE1hdGgubG9nKE1hdGgudGFuKGxhdCAvIDIgKyBNYXRoLlBJIC8gNCkpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgcHJvamVjdChsYXQsIGxvbiwgd2luZHkpIHtcclxuICAgICAgICAvLyBib3RoIGluIHJhZGlhbnMsIHVzZSBkZWcycmFkIGlmIG5lY2Nlc3NhcnlcclxuICAgICAgICBsZXQgeW1pbiA9IHRoaXMubWVyY1kod2luZHkuc291dGgpO1xyXG4gICAgICAgIGxldCB5bWF4ID0gdGhpcy5tZXJjWSh3aW5keS5ub3J0aCk7XHJcbiAgICAgICAgbGV0IHhGYWN0b3IgPSB3aW5keS53aWR0aCAvICh3aW5keS5lYXN0IC0gd2luZHkud2VzdCk7XHJcbiAgICAgICAgbGV0IHlGYWN0b3IgPSB3aW5keS5oZWlnaHQgLyAoeW1heCAtIHltaW4pO1xyXG5cclxuICAgICAgICBsZXQgeSA9IHRoaXMubWVyY1kodGhpcy5kZWcycmFkKGxhdCkpO1xyXG4gICAgICAgIGxldCB4ID0gKHRoaXMuZGVnMnJhZChsb24pIC0gd2luZHkud2VzdCkgKiB4RmFjdG9yO1xyXG4gICAgICAgIHkgPSAoeW1heCAtIHkpICogeUZhY3RvcjsgLy8geSBwb2ludHMgc291dGhcclxuICAgICAgICByZXR1cm4gW3gsIHldO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgaW52ZXJ0KHgsIHksIHdpbmR5KSB7XHJcbiAgICAgICAgbGV0IG1hcExvbkRlbHRhID0gd2luZHkuZWFzdCAtIHdpbmR5Lndlc3Q7XHJcbiAgICAgICAgbGV0IHdvcmxkTWFwUmFkaXVzID0gd2luZHkud2lkdGggLyB0aGlzLnJhZDJkZWcobWFwTG9uRGVsdGEpICogMzYwIC8gKDIgKiBNYXRoLlBJKTtcclxuICAgICAgICBsZXQgbWFwT2Zmc2V0WSA9IHdvcmxkTWFwUmFkaXVzIC8gMiAqIE1hdGgubG9nKCgxICsgTWF0aC5zaW4od2luZHkuc291dGgpKSAvICgxIC0gTWF0aC5zaW4od2luZHkuc291dGgpKSk7XHJcbiAgICAgICAgbGV0IGVxdWF0b3JZID0gd2luZHkuaGVpZ2h0ICsgbWFwT2Zmc2V0WTtcclxuICAgICAgICBsZXQgYSA9IChlcXVhdG9yWSAtIHkpIC8gd29ybGRNYXBSYWRpdXM7XHJcblxyXG4gICAgICAgIGxldCBsYXQgPSAxODAgLyBNYXRoLlBJICogKDIgKiBNYXRoLmF0YW4oTWF0aC5leHAoYSkpIC0gTWF0aC5QSSAvIDIpO1xyXG4gICAgICAgIGxldCBsb24gPSB0aGlzLnJhZDJkZWcod2luZHkud2VzdCkgKyB4IC8gd2luZHkud2lkdGggKiB0aGlzLnJhZDJkZWcobWFwTG9uRGVsdGEpO1xyXG4gICAgICAgIHJldHVybiBbbG9uLCBsYXRdO1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICBwcml2YXRlIGludGVycG9sYXRlRmllbGQoZ3JpZCwgYm91bmRzLCBleHRlbnQsIGNhbGxiYWNrKSB7XHJcblxyXG4gICAgICAgIGxldCBwcm9qZWN0aW9uID0ge307XHJcbiAgICAgICAgbGV0IG1hcEFyZWEgPSAoZXh0ZW50LnNvdXRoIC0gZXh0ZW50Lm5vcnRoKSAqIChleHRlbnQud2VzdCAtIGV4dGVudC5lYXN0KTtcclxuICAgICAgICBsZXQgdmVsb2NpdHlTY2FsZSA9IHRoaXMuVkVMT0NJVFlfU0NBTEUgKiBNYXRoLnBvdyhtYXBBcmVhLCAwLjQpO1xyXG5cclxuICAgICAgICBsZXQgY29sdW1ucyA9IFtdO1xyXG4gICAgICAgIGxldCB4ID0gYm91bmRzLng7XHJcblxyXG4gICAgICAgIGxldCBpbnRlcnBvbGF0ZUNvbHVtbiA9ICh4KSA9PiB7XHJcbiAgICAgICAgICAgIGxldCBjb2x1bW4gPSBbXTtcclxuICAgICAgICAgICAgZm9yIChsZXQgeSA9IGJvdW5kcy55OyB5IDw9IGJvdW5kcy55TWF4OyB5ICs9IDIpIHtcclxuICAgICAgICAgICAgICAgIGxldCBjb29yZCA9IHRoaXMuaW52ZXJ0KHgsIHksIGV4dGVudCk7XHJcbiAgICAgICAgICAgICAgICBpZiAoY29vcmQpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgzrsgPSBjb29yZFswXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgz4YgPSBjb29yZFsxXTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoaXNGaW5pdGUozrspKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vbGV0IHdpbmQgPSBncmlkLmludGVycG9sYXRlKM67LCDPhik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCB3aW5kID0gdGhpcy5pbnRlcnBvbGF0ZSjOuywgz4YpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAod2luZCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgd2luZCA9IHRoaXMuZGlzdG9ydChwcm9qZWN0aW9uLCDOuywgz4YsIHgsIHksIHZlbG9jaXR5U2NhbGUsIHdpbmQsIGV4dGVudCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2x1bW5beSArIDFdID0gY29sdW1uW3ldID0gd2luZDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBjb2x1bW5zW3ggKyAxXSA9IGNvbHVtbnNbeF0gPSBjb2x1bW47XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgbGV0IGJhdGNoSW50ZXJwb2xhdGUgPSAoKSA9PiB7XHJcbiAgICAgICAgICAgIGxldCBzdGFydCA9IERhdGUubm93KCk7XHJcbiAgICAgICAgICAgIHdoaWxlICh4IDwgYm91bmRzLndpZHRoKSB7XHJcbiAgICAgICAgICAgICAgICBpbnRlcnBvbGF0ZUNvbHVtbih4KTtcclxuICAgICAgICAgICAgICAgIHggKz0gMjtcclxuICAgICAgICAgICAgICAgIGlmIChEYXRlLm5vdygpIC0gc3RhcnQgPiAxMDAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy9NQVhfVEFTS19USU1FKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiBiYXRjaEludGVycG9sYXRlLCAyNSk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHRoaXMuY3JlYXRlRmllbGQoY29sdW1ucywgYm91bmRzLCBjYWxsYmFjayk7XHJcbiAgICAgICAgfTtcclxuICAgICAgICBiYXRjaEludGVycG9sYXRlKCk7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIHByaXZhdGUgY3JlYXRlRmllbGQoY29sdW1ucywgYm91bmRzLCBjYWxsYmFjaykge1xyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAqIEByZXR1cm5zIHtBcnJheX0gd2luZCB2ZWN0b3IgW3UsIHYsIG1hZ25pdHVkZV0gYXQgdGhlIHBvaW50ICh4LCB5KSwgb3IgW05hTiwgTmFOLCBudWxsXSBpZiB3aW5kXHJcbiAgICAgICAgKiAgICAgICAgICBpcyB1bmRlZmluZWQgYXQgdGhhdCBwb2ludC5cclxuICAgICAgICAqL1xyXG4gICAgICAgIGxldCBmaWVsZDogYW55ID0gKHgsIHkpID0+IHtcclxuICAgICAgICAgICAgdmFyIGNvbHVtbiA9IGNvbHVtbnNbTWF0aC5yb3VuZCh4KV07XHJcbiAgICAgICAgICAgIHJldHVybiBjb2x1bW4gJiYgY29sdW1uW01hdGgucm91bmQoeSldIHx8IHRoaXMuTlVMTF9XSU5EX1ZFQ1RPUjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIEZyZWVzIHRoZSBtYXNzaXZlIFwiY29sdW1uc1wiIGFycmF5IGZvciBHQy4gV2l0aG91dCB0aGlzLCB0aGUgYXJyYXkgaXMgbGVha2VkIChpbiBDaHJvbWUpIGVhY2ggdGltZSBhIG5ld1xyXG4gICAgICAgIC8vIGZpZWxkIGlzIGludGVycG9sYXRlZCBiZWNhdXNlIHRoZSBmaWVsZCBjbG9zdXJlJ3MgY29udGV4dCBpcyBsZWFrZWQsIGZvciByZWFzb25zIHRoYXQgZGVmeSBleHBsYW5hdGlvbi5cclxuICAgICAgICBmaWVsZC5yZWxlYXNlID0gKCkgPT4ge1xyXG4gICAgICAgICAgICBjb2x1bW5zID0gW107XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgZmllbGQucmFuZG9taXplID0gKG8pID0+IHtcclxuICAgICAgICAgICAgLy8gVU5ET05FOiB0aGlzIG1ldGhvZCBpcyB0ZXJyaWJsZVxyXG4gICAgICAgICAgICB2YXIgeCwgeTtcclxuICAgICAgICAgICAgdmFyIHNhZmV0eU5ldCA9IDA7XHJcbiAgICAgICAgICAgIGRvIHtcclxuICAgICAgICAgICAgICAgIHggPSBNYXRoLnJvdW5kKE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIGJvdW5kcy53aWR0aCkgKyBib3VuZHMueCk7XHJcbiAgICAgICAgICAgICAgICB5ID0gTWF0aC5yb3VuZChNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBib3VuZHMuaGVpZ2h0KSArIGJvdW5kcy55KTtcclxuICAgICAgICAgICAgfSB3aGlsZSAoZmllbGQoeCwgeSlbMl0gPT09IG51bGwgJiYgc2FmZXR5TmV0KysgPCAzMCk7XHJcbiAgICAgICAgICAgIG8ueCA9IHg7XHJcbiAgICAgICAgICAgIG8ueSA9IHk7XHJcbiAgICAgICAgICAgIHJldHVybiBvO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGNhbGxiYWNrKGJvdW5kcywgZmllbGQpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYW5pbWF0ZShib3VuZHMsIGZpZWxkKSB7XHJcblxyXG4gICAgICAgIGxldCB3aW5kSW50ZW5zaXR5Q29sb3JTY2FsZSA9IChtaW4sIG1heCkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLmNvbG9yU2NhbGUuaW5kZXhGb3IgPSAobSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgLy8gbWFwIHZlbG9jaXR5IHNwZWVkIHRvIGEgc3R5bGVcclxuICAgICAgICAgICAgICAgIHJldHVybiBNYXRoLm1heCgwLCBNYXRoLm1pbih0aGlzLmNvbG9yU2NhbGUubGVuZ3RoIC0gMSwgTWF0aC5yb3VuZCgobSAtIG1pbikgLyAobWF4IC0gbWluKSAqICh0aGlzLmNvbG9yU2NhbGUubGVuZ3RoIC0gMSkpKSk7XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNvbG9yU2NhbGU7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgY29sb3JTdHlsZXMgPSB3aW5kSW50ZW5zaXR5Q29sb3JTY2FsZSh0aGlzLk1JTl9WRUxPQ0lUWV9JTlRFTlNJVFksIHRoaXMuTUFYX1ZFTE9DSVRZX0lOVEVOU0lUWSk7XHJcbiAgICAgICAgbGV0IGJ1Y2tldHMgPSBjb2xvclN0eWxlcy5tYXAoZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gW107XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGxldCBwYXJ0aWNsZUNvdW50ID0gTWF0aC5yb3VuZChib3VuZHMud2lkdGggKiBib3VuZHMuaGVpZ2h0ICogdGhpcy5QQVJUSUNMRV9NVUxUSVBMSUVSIC8gMTAwMCk7XHJcbiAgICAgICAgaWYgKHRoaXMuaXNNb2JpbGUoKSkge1xyXG4gICAgICAgICAgICBwYXJ0aWNsZUNvdW50ICo9IHRoaXMuUEFSVElDTEVfUkVEVUNUSU9OO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IGZhZGVGaWxsU3R5bGUgPSBcInJnYmEoMCwgMCwgMCwgMC45NylcIjtcclxuXHJcbiAgICAgICAgbGV0IHBhcnRpY2xlcyA9IFtdO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcGFydGljbGVDb3VudDsgaSsrKSB7XHJcbiAgICAgICAgICAgIHBhcnRpY2xlcy5wdXNoKGZpZWxkLnJhbmRvbWl6ZSh7IGFnZTogTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogdGhpcy5NQVhfUEFSVElDTEVfQUdFKSArIDAgfSkpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IGV2b2x2ZSA9ICgpID0+IHtcclxuICAgICAgICAgICAgYnVja2V0cy5mb3JFYWNoKChidWNrZXQpID0+IHtcclxuICAgICAgICAgICAgICAgIGJ1Y2tldC5sZW5ndGggPSAwO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgcGFydGljbGVzLmZvckVhY2goKHBhcnRpY2xlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZiAocGFydGljbGUuYWdlID4gdGhpcy5NQVhfUEFSVElDTEVfQUdFKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZmllbGQucmFuZG9taXplKHBhcnRpY2xlKS5hZ2UgPSAwO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgdmFyIHggPSBwYXJ0aWNsZS54O1xyXG4gICAgICAgICAgICAgICAgdmFyIHkgPSBwYXJ0aWNsZS55O1xyXG4gICAgICAgICAgICAgICAgdmFyIHYgPSBmaWVsZCh4LCB5KTsgLy8gdmVjdG9yIGF0IGN1cnJlbnQgcG9zaXRpb25cclxuICAgICAgICAgICAgICAgIHZhciBtID0gdlsyXTtcclxuICAgICAgICAgICAgICAgIGlmIChtID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcGFydGljbGUuYWdlID0gdGhpcy5NQVhfUEFSVElDTEVfQUdFOyAvLyBwYXJ0aWNsZSBoYXMgZXNjYXBlZCB0aGUgZ3JpZCwgbmV2ZXIgdG8gcmV0dXJuLi4uXHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciB4dCA9IHggKyB2WzBdO1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciB5dCA9IHkgKyB2WzFdO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChmaWVsZCh4dCwgeXQpWzJdICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFBhdGggZnJvbSAoeCx5KSB0byAoeHQseXQpIGlzIHZpc2libGUsIHNvIGFkZCB0aGlzIHBhcnRpY2xlIHRvIHRoZSBhcHByb3ByaWF0ZSBkcmF3IGJ1Y2tldC5cclxuICAgICAgICAgICAgICAgICAgICAgICAgcGFydGljbGUueHQgPSB4dDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcGFydGljbGUueXQgPSB5dDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYnVja2V0c1tjb2xvclN0eWxlcy5pbmRleEZvcihtKV0ucHVzaChwYXJ0aWNsZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gUGFydGljbGUgaXNuJ3QgdmlzaWJsZSwgYnV0IGl0IHN0aWxsIG1vdmVzIHRocm91Z2ggdGhlIGZpZWxkLlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJ0aWNsZS54ID0geHQ7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcnRpY2xlLnkgPSB5dDtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBwYXJ0aWNsZS5hZ2UgKz0gMTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgZyA9IHRoaXMuY2FudmFzLmdldENvbnRleHQoXCIyZFwiKTtcclxuICAgICAgICBnLmxpbmVXaWR0aCA9IHRoaXMuUEFSVElDTEVfTElORV9XSURUSDtcclxuICAgICAgICBnLmZpbGxTdHlsZSA9IGZhZGVGaWxsU3R5bGU7XHJcbiAgICAgICAgZy5nbG9iYWxBbHBoYSA9IDAuNjtcclxuXHJcbiAgICAgICAgbGV0IGRyYXcgPSAoKSA9PiB7XHJcbiAgICAgICAgICAgIC8vIEZhZGUgZXhpc3RpbmcgcGFydGljbGUgdHJhaWxzLlxyXG4gICAgICAgICAgICBsZXQgcHJldiA9IFwibGlnaHRlclwiO1xyXG4gICAgICAgICAgICBnLmdsb2JhbENvbXBvc2l0ZU9wZXJhdGlvbiA9IFwiZGVzdGluYXRpb24taW5cIjtcclxuICAgICAgICAgICAgZy5maWxsUmVjdChib3VuZHMueCwgYm91bmRzLnksIGJvdW5kcy53aWR0aCwgYm91bmRzLmhlaWdodCk7XHJcbiAgICAgICAgICAgIGcuZ2xvYmFsQ29tcG9zaXRlT3BlcmF0aW9uID0gcHJldjtcclxuICAgICAgICAgICAgZy5nbG9iYWxBbHBoYSA9IDAuOTtcclxuXHJcbiAgICAgICAgICAgIC8vIERyYXcgbmV3IHBhcnRpY2xlIHRyYWlscy5cclxuICAgICAgICAgICAgYnVja2V0cy5mb3JFYWNoKChidWNrZXQsIGkpID0+IHtcclxuICAgICAgICAgICAgICAgIGlmIChidWNrZXQubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGcuYmVnaW5QYXRoKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgZy5zdHJva2VTdHlsZSA9IGNvbG9yU3R5bGVzW2ldO1xyXG4gICAgICAgICAgICAgICAgICAgIGJ1Y2tldC5mb3JFYWNoKChwYXJ0aWNsZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBnLm1vdmVUbyhwYXJ0aWNsZS54LCBwYXJ0aWNsZS55KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZy5saW5lVG8ocGFydGljbGUueHQsIHBhcnRpY2xlLnl0KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcGFydGljbGUueCA9IHBhcnRpY2xlLnh0O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJ0aWNsZS55ID0gcGFydGljbGUueXQ7XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgZy5zdHJva2UoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgdGhlbiA9IERhdGUubm93KCk7XHJcbiAgICAgICAgbGV0IGZyYW1lID0gKCkgPT4ge1xyXG4gICAgICAgICAgICBXaW5keS5hbmltYXRpb25Mb29wID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKGZyYW1lKTtcclxuICAgICAgICAgICAgdmFyIG5vdyA9IERhdGUubm93KCk7XHJcbiAgICAgICAgICAgIHZhciBkZWx0YSA9IG5vdyAtIHRoZW47XHJcbiAgICAgICAgICAgIGlmIChkZWx0YSA+IHRoaXMuRlJBTUVfVElNRSkge1xyXG4gICAgICAgICAgICAgICAgdGhlbiA9IG5vdyAtIGRlbHRhICUgdGhpcy5GUkFNRV9USU1FO1xyXG4gICAgICAgICAgICAgICAgZXZvbHZlKCk7XHJcbiAgICAgICAgICAgICAgICBkcmF3KCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9O1xyXG4gICAgICAgIGZyYW1lKCk7XHJcbiAgICB9XHJcbn1cclxuXHJcbmlmICghd2luZG93LmNhbmNlbEFuaW1hdGlvbkZyYW1lKSB7XHJcbiAgICB3aW5kb3cuY2FuY2VsQW5pbWF0aW9uRnJhbWUgPSAoaWQpID0+IHtcclxuICAgICAgICBjbGVhclRpbWVvdXQoaWQpO1xyXG4gICAgfTtcclxufSJdfQ==
