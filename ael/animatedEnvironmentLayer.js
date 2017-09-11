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
                console.log(currentZoom + " - " + pm);
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
                // Scan mode 0. Longitude increases from λ0, and latitude increases from φ0.
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3R5cGVzY3JpcHQvYW5pbWF0ZWRFbnZpcm9ubWVudExheWVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDJFQUEyRTtBQUMzRSx3QkFBd0I7QUFDeEIsRUFBRTtBQUNGLGtDQUFrQztBQUNsQyxFQUFFO0FBQ0Ysc0RBQXNEO0FBQ3RELEVBQUU7QUFDRiwyRUFBMkU7QUFDM0UsOEVBQThFO0FBQzlFLDZFQUE2RTtBQUM3RSw0RUFBNEU7QUFDNUUseUVBQXlFO0FBQ3pFLHVFQUF1RTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7SUFvRnZFO1FBQThDLDRDQUEyQjtRQXNDckUsa0NBQVksVUFBOEM7WUFBMUQsWUFDSSxrQkFBTSxVQUFVLENBQUMsU0FtQnBCO1lBNUJPLG9CQUFjLEdBQVcsQ0FBQyxDQUFDO1lBRTNCLGdCQUFVLEdBQVksS0FBSyxDQUFDO1lBU2hDLDZEQUE2RDtZQUM3RCxLQUFJLENBQUMsV0FBVyxHQUFHLFVBQVUsQ0FBQyxVQUFVLENBQUM7WUFDekMsS0FBSSxDQUFDLEdBQUcsR0FBRyxVQUFVLENBQUMsR0FBRyxDQUFDO1lBQzFCLEtBQUksQ0FBQyxjQUFjLEdBQUcsVUFBVSxDQUFDLGNBQWMsSUFBSSxFQUFFLENBQUM7WUFDdEQsS0FBSSxDQUFDLFlBQVksR0FBRyxVQUFVLENBQUMsWUFBWSxLQUFLLEtBQUssR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDLENBQUMsa0JBQWtCO1lBRXhGLEtBQUksQ0FBQyxFQUFFLENBQUMsa0JBQWtCLEVBQUUsVUFBQyxHQUFHLElBQUssT0FBQSxLQUFJLENBQUMsaUJBQWlCLENBQUMsR0FBRyxDQUFDLEVBQTNCLENBQTJCLENBQUMsQ0FBQztZQUVsRSwyREFBMkQ7WUFDM0QsVUFBVSxDQUFDLEtBQUssQ0FBQyxLQUFJLEVBQUUsS0FBSyxFQUFFLFVBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxJQUFLLE9BQUEsS0FBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLEVBQUUs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QUNSLEtBQUssQ0FBQyxhQUFhLEdBQUcscUJBQXFCLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQ25ELElBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztnQkFDckIsSUFBSSxLQUFLLEdBQUcsR0FBRyxHQUFHLElBQUksQ0FBQztnQkFDdkIsRUFBRSxDQUFDLENBQUMsS0FBSyxHQUFHLEtBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO29CQUMxQixJQUFJLEdBQUcsR0FBRyxHQUFHLEtBQUssR0FBRyxLQUFJLENBQUMsVUFBVSxDQUFDO29CQUNyQyxNQUFNLEVBQUUsQ0FBQztvQkFDVCxJQUFJLEVBQUUsQ0FBQztnQkFDWCxDQUFDO1lBQ0wsQ0FBQyxDQUFDO1lBQ0YsS0FBSyxFQUFFLENBQUM7UUFDWixDQUFDO1FBQ0wsWUFBQztJQUFELENBL2tCQSxBQStrQkMsSUFBQTtJQUVELEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQztRQUMvQixNQUFNLENBQUMsb0JBQW9CLEdBQUcsVUFBQyxFQUFFO1lBQzdCLFlBQVksQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNyQixDQUFDLENBQUM7SUFDTixDQUFDIiwiZmlsZSI6ImFuaW1hdGVkRW52aXJvbm1lbnRMYXllci5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xyXG4vLyBUaGUgTUlUIExpY2Vuc2UgKE1JVClcclxuLy9cclxuLy8gQ29weXJpZ2h0IChjKSAyMDE3IE5pY2sgQ2FtZXJvblxyXG4vL1xyXG4vLyBodHRwczovL2dpdGh1Yi5jb20vbmlja2NhbS9BbmltYXRlZEVudmlyb25tZW50TGF5ZXJcclxuLy9cclxuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGEgXHJcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGUgXCJTb2Z0d2FyZVwiKSwgXHJcbi8vIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZyB3aXRob3V0IGxpbWl0YXRpb24gXHJcbi8vIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLCBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBcclxuLy8gYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdCBwZXJzb25zIHRvIHdob20gdGhlIFxyXG4vLyBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlIGZvbGxvd2luZyBjb25kaXRpb25zOlxyXG5cclxuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgXHJcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxyXG5cclxuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTUyBcclxuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFksIFxyXG4vLyBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTiBOTyBFVkVOVCBTSEFMTCBcclxuLy8gVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sIERBTUFHRVMgT1IgT1RIRVJcclxuLy8gTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUiBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgXHJcbi8vIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRSBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gXHJcbi8vIFRIRSBTT0ZUV0FSRS5cclxuLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXHJcblxyXG5pbXBvcnQgKiBhcyBNYXBWaWV3IGZyb20gXCJlc3JpL3ZpZXdzL01hcFZpZXdcIjtcclxuaW1wb3J0ICogYXMgU2NlbmVWaWV3IGZyb20gXCJlc3JpL3ZpZXdzL1NjZW5lVmlld1wiO1xyXG5pbXBvcnQgKiBhcyBHcmFwaGljc0xheWVyIGZyb20gXCJlc3JpL2xheWVycy9HcmFwaGljc0xheWVyXCI7XHJcbmltcG9ydCAqIGFzIHByb21pc2VVdGlscyBmcm9tIFwiZXNyaS9jb3JlL3Byb21pc2VVdGlsc1wiO1xyXG5pbXBvcnQgKiBhcyBlc3JpUmVxdWVzdCBmcm9tIFwiZXNyaS9yZXF1ZXN0XCI7XHJcbmltcG9ydCAqIGFzIEV4dGVudCBmcm9tIFwiZXNyaS9nZW9tZXRyeS9FeHRlbnRcIjtcclxuaW1wb3J0ICogYXMgd2ViTWVyY2F0b3JVdGlscyBmcm9tIFwiZXNyaS9nZW9tZXRyeS9zdXBwb3J0L3dlYk1lcmNhdG9yVXRpbHNcIjtcclxuaW1wb3J0ICogYXMgd2F0Y2hVdGlscyBmcm9tIFwiZXNyaS9jb3JlL3dhdGNoVXRpbHNcIjtcclxuaW1wb3J0ICogYXMgU3BhdGlhbFJlZmVyZW5jZSBmcm9tIFwiZXNyaS9nZW9tZXRyeS9TcGF0aWFsUmVmZXJlbmNlXCI7XHJcbmltcG9ydCAqIGFzIFBvaW50IGZyb20gXCJlc3JpL2dlb21ldHJ5L1BvaW50XCI7XHJcbmltcG9ydCAqIGFzIGFzZCBmcm9tIFwiZXNyaS9jb3JlL2FjY2Vzc29yU3VwcG9ydC9kZWNvcmF0b3JzXCI7XHJcbmltcG9ydCAqIGFzIHF1ZXJ5IGZyb20gXCJkb2pvL3F1ZXJ5XCI7XHJcblxyXG4vKiogXHJcbiAgICBUaGUgYXZhaWxhYmxlIGRpc3BsYXkgb3B0aW9ucyB0byBjaGFuZWcgdGhlIHBhcnRpY2xlIHJlbmRlcmluZ1xyXG4qL1xyXG5leHBvcnQgaW50ZXJmYWNlIERpc3BsYXlPcHRpb25zIHtcclxuICAgIG1pblZlbG9jaXR5PzogbnVtYmVyO1xyXG4gICAgbWF4VmVsb2NpdHk/OiBudW1iZXI7XHJcbiAgICB2ZWxvY2l0eVNjYWxlPzogbnVtYmVyO1xyXG4gICAgcGFydGljbGVBZ2U/OiBudW1iZXI7XHJcbiAgICBwYXJ0aWNsZUxpbmVXaWR0aD86IG51bWJlcjtcclxuICAgIHBhcnRpY2xlTXVsdGlwbGllcj86IG51bWJlcjtcclxuICAgIHBhcnRpY2xlTXVsdGlwbGllckJ5Wm9vbT86IFBhcnRpY2xlTXVsdGlwbGllckJ5Wm9vbSxcclxuICAgIGZyYW1lUmF0ZT86IG51bWJlcjtcclxuICAgIGNvbG9yU2NhbGU/OiBzdHJpbmdbXTtcclxuICAgIGxpbmVXaWR0aD86IG51bWJlcjtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gICAgQW4gc2ltcGxlIG9iamVjdCB0byBkZWZpbmUgZHluYW1pYyBwYXJ0aWNsZSBtdWx0aXBsaWVycyBkZXBlbmRpbmcgb24gY3VycmVudCB6b29tIGxldmVsLlxyXG4gICAgQSBiYXNpYyBhdHRlbXB0IHRvIGNhdGVyIGZvciBwYXJ0aWNsZXMgZGlzcGxheWluZyB0b28gZGVuc2VseSBvbiBjbG9zZSBpbiB6b29tIGxldmVscy5cclxuKi9cclxuZXhwb3J0IGludGVyZmFjZSBQYXJ0aWNsZU11bHRpcGxpZXJCeVpvb20ge1xyXG4gICAgLy8gdGhlIGJhc2Ugem9vbSBsZXZlbCB0byBzdGFydCBjYWxjdWxhdGluZyBhdC4gRmluZCBhIHBhcml0aWNsZSBtdWx0aXBsZXIgYXQgdGhpcyB6b29tIGxldmVsIHRoYXQgbG9va3MgZ29vZCBmb3IgeW91ciBkYXRhLlxyXG4gICAgem9vbUxldmVsOiBudW1iZXIsXHJcblxyXG4gICAgLy8gVGhlIHBhcnRpY2xlIG11bHRpcGxpZXIgZm9yIHRoZSBiYXNlIHpvb20gbGV2ZWwgc3BlY2lmaWVkIGFib3ZlLiBGaW5kIGEgcGFydGljbGUgbXVsdGlwbGVyIGF0IHRoaXMgem9vbSBsZXZlbCB0aGF0IGxvb2tzIGdvb2QgZm9yIHlvdXIgZGF0YS5cclxuICAgIHBhcnRpY2xlTXVsdGlwbGllcjogbnVtYmVyLFxyXG5cclxuICAgIC8vIFRoZSBhbW91bnQgdG8gc3VidHJhY3Qgb3IgYWRkIHRvIHRoZSBwYXJ0aWNsZSBtdWx0aXBsaWVyIGRlcGVuZGluZyBvbiB6b29tIGxldmVsXHJcbiAgICBkaWZmUmF0aW86IG51bWJlcixcclxuXHJcbiAgICAvLyB0aGUgbWluIHZhbHVlIHRoZSBtdWx0aXBsaWVyIGNhbiBnb1xyXG4gICAgbWluTXVsdGlwbGllcjogbnVtYmVyLFxyXG5cclxuICAgIC8vIHRoZSBtYXggdmFsdWUgdGhlIG11bHRpcGxpZXIgY2FuIGdvXHJcbiAgICBtYXhNdWx0aXBsaWVyOiBudW1iZXJcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gVGhlIHJldHVybiBvYmplY3QgZnJvbSB0aGUgcG9pbnQtcmVwb3J0IGV2ZW50XHJcbiovXHJcbmV4cG9ydCBpbnRlcmZhY2UgUG9pbnRSZXBvcnQge1xyXG4gICAgcG9pbnQ6IFBvaW50O1xyXG4gICAgdGFyZ2V0OiBBbmltYXRlZEVudmlyb25tZW50TGF5ZXI7XHJcbiAgICBkZWdyZWU/OiBudW1iZXI7XHJcbiAgICB2ZWxvY2l0eT86IG51bWJlcjtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBBbmltYXRlZEVudmlyb25tZW50TGF5ZXJQcm9wZXJ0aWVzIGV4dGVuZHMgX19lc3JpLkdyYXBoaWNzTGF5ZXJQcm9wZXJ0aWVzIHtcclxuICAgIGFjdGl2ZVZpZXc/OiBNYXBWaWV3IHwgU2NlbmVWaWV3O1xyXG4gICAgdXJsPzogc3RyaW5nO1xyXG4gICAgZGlzcGxheU9wdGlvbnM/OiBEaXNwbGF5T3B0aW9ucztcclxuICAgIHJlcG9ydFZhbHVlcz86IGJvb2xlYW47XHJcbn1cclxuXHJcbkBhc2Quc3ViY2xhc3MoXCJBbmltYXRlZEVudmlyb25tZW50TGF5ZXJcIilcclxuZXhwb3J0IGNsYXNzIEFuaW1hdGVkRW52aXJvbm1lbnRMYXllciBleHRlbmRzIGFzZC5kZWNsYXJlZChHcmFwaGljc0xheWVyKSB7XHJcblxyXG4gICAgLy9hZGQgdGhlIEV2ZW50ZWQgZnVuY3Rpb25zIGFzIHByb3BlcnRpZXMgc28gdHlwZXNjcmlwdCBpcyBoYXBweSB1c2luZyBpdC4gVGhlcmUncyBwcm9iYWJseSBiZXR0ZXIgd2F5cyB0byBpbmNsdWRlIGEgbWl4aW4ncyBwcm9wZXJ0aWVzP1xyXG4gICAgZW1pdDogKGV2ZW50TmFtZTogc3RyaW5nLCBldmVudDogYW55KSA9PiBGdW5jdGlvbjtcclxuXHJcbiAgICBAYXNkLnByb3BlcnR5KClcclxuICAgIHVybDogc3RyaW5nO1xyXG5cclxuICAgIEBhc2QucHJvcGVydHkoKVxyXG4gICAgZGlzcGxheU9wdGlvbnM6IERpc3BsYXlPcHRpb25zO1xyXG5cclxuICAgIEBhc2QucHJvcGVydHkoKVxyXG4gICAgcmVwb3J0VmFsdWVzOiBib29sZWFuO1xyXG5cclxuICAgIEBhc2QucHJvcGVydHkoKVxyXG4gICAgZGF0YUxvYWRpbmc6IGJvb2xlYW47XHJcblxyXG4gICAgcHJpdmF0ZSBfd2luZHk6IFdpbmR5O1xyXG4gICAgcHJpdmF0ZSBfZGF0YUZldGNoUmVxdWlyZWQ6IGJvb2xlYW47XHJcblxyXG4gICAgcHJpdmF0ZSBfY2FudmFzMmQ6IEhUTUxDYW52YXNFbGVtZW50O1xyXG4gICAgcHJpdmF0ZSBfY2FudmFzM2Q6IEhUTUxDYW52YXNFbGVtZW50O1xyXG5cclxuICAgIHByaXZhdGUgX2xheWVyVmlldzJkOiBhbnk7XHJcbiAgICBwcml2YXRlIF9sYXllclZpZXczZDogYW55O1xyXG5cclxuICAgIHByaXZhdGUgX3NvdXRoV2VzdDogUG9pbnQ7XHJcbiAgICBwcml2YXRlIF9ub3J0aEVhc3Q6IFBvaW50O1xyXG5cclxuICAgIHByaXZhdGUgX2FjdGl2ZVZpZXc6IE1hcFZpZXcgfCBTY2VuZVZpZXc7XHJcbiAgICBwcml2YXRlIF92aWV3TG9hZENvdW50OiBudW1iZXIgPSAwO1xyXG5cclxuICAgIHByaXZhdGUgX2lzRHJhd2luZzogYm9vbGVhbiA9IGZhbHNlO1xyXG4gICAgcHJpdmF0ZSBfcXVldWVkRHJhdzogYm9vbGVhbjtcclxuXHJcblxyXG4gICAgZGF0ZTogRGF0ZTtcclxuXHJcbiAgICBjb25zdHJ1Y3Rvcihwcm9wZXJ0aWVzOiBBbmltYXRlZEVudmlyb25tZW50TGF5ZXJQcm9wZXJ0aWVzKSB7XHJcbiAgICAgICAgc3VwZXIocHJvcGVydGllcyk7XHJcblxyXG4gICAgICAgIC8vIElmIHRoZSBhY3RpdmUgdmlldyBpcyBzZXQgaW4gcHJvcGVydGllcywgdGhlbiBzZXQgaXQgaGVyZS5cclxuICAgICAgICB0aGlzLl9hY3RpdmVWaWV3ID0gcHJvcGVydGllcy5hY3RpdmVWaWV3O1xyXG4gICAgICAgIHRoaXMudXJsID0gcHJvcGVydGllcy51cmw7XHJcbiAgICAgICAgdGhpcy5kaXNwbGF5T3B0aW9ucyA9IHByb3BlcnRpZXMuZGlzcGxheU9wdGlvbnMgfHwge307XHJcbiAgICAgICAgdGhpcy5yZXBvcnRWYWx1ZXMgPSBwcm9wZXJ0aWVzLnJlcG9ydFZhbHVlcyA9PT0gZmFsc2UgPyBmYWxzZSA6IHRydWU7IC8vIGRlZmF1bHQgdG8gdHJ1ZVxyXG5cclxuICAgICAgICB0aGlzLm9uKFwibGF5ZXJ2aWV3LWNyZWF0ZVwiLCAoZXZ0KSA9PiB0aGlzLl9sYXllclZpZXdDcmVhdGVkKGV2dCkpO1xyXG5cclxuICAgICAgICAvLyB3YXRjaCB1cmwgcHJvcCBzbyBhIGZldGNoIG9mIGRhdGEgYW5kIHJlZHJhdyB3aWxsIG9jY3VyLlxyXG4gICAgICAgIHdhdGNoVXRpbHMud2F0Y2godGhpcywgXCJ1cmxcIiwgKGEsIGIsIGMsIGQpID0+IHRoaXMuX3VybENoYW5nZWQoYSwgYiwgYywgZCkpO1xyXG5cclxuICAgICAgICAvLyB3YXRjaCB1cmwgcHJvcCBzbyBhIGZldGNoIG9mIGRhdGEgYW5kIHJlZHJhdyB3aWxsIG9jY3VyLlxyXG4gICAgICAgIHdhdGNoVXRpbHMud2F0Y2godGhpcywgXCJ2aXNpYmxlXCIsIChhLCBiLCBjLCBkKSA9PiB0aGlzLl92aXNpYmxlQ2hhbmdlZChhLCBiLCBjLCBkKSk7XHJcblxyXG4gICAgICAgIC8vIHdhdGNoIGRpc3BsYXkgb3B0aW9ucyBzbyB0byByZWRyYXcgd2hlbiBjaGFuZ2VkLlxyXG4gICAgICAgIHdhdGNoVXRpbHMud2F0Y2godGhpcywgXCJkaXNwbGF5T3B0aW9uc1wiLCAoYSwgYiwgYywgZCkgPT4gdGhpcy5fZGlzcGxheU9wdGlvbnNDaGFuZ2VkKGEsIGIsIGMsIGQpKTtcclxuICAgICAgICB0aGlzLl9kYXRhRmV0Y2hSZXF1aXJlZCA9IHRydWU7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBTdGFydCBhIGRyYXdcclxuICAgICAqL1xyXG4gICAgZHJhdyhmb3JjZURhdGFSZWZldGNoPzogYm9vbGVhbikge1xyXG5cclxuICAgICAgICBpZiAoZm9yY2VEYXRhUmVmZXRjaCAhPSBudWxsKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2RhdGFGZXRjaFJlcXVpcmVkID0gZm9yY2VEYXRhUmVmZXRjaDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICghdGhpcy51cmwgfHwgIXRoaXMudmlzaWJsZSkgcmV0dXJuOyAvLyBubyB1cmwgc2V0LCBub3QgdmlzaWJsZSBvciBpcyBjdXJyZW50bHkgZHJhd2luZywgZXhpdCBoZXJlLlxyXG5cclxuICAgICAgICB0aGlzLl9pc0RyYXdpbmcgPSB0cnVlO1xyXG4gICAgICAgIHRoaXMuX3NldHVwRHJhdyh0aGlzLl9hY3RpdmVWaWV3LndpZHRoLCB0aGlzLl9hY3RpdmVWaWV3LmhlaWdodCk7XHJcblxyXG4gICAgICAgIC8vIGlmIGRhdGEgc2hvdWxkIGJlIGZldGNoZWQsIGdvIGdldCBpdCBub3cuXHJcbiAgICAgICAgaWYgKHRoaXMuX2RhdGFGZXRjaFJlcXVpcmVkKSB7XHJcblxyXG4gICAgICAgICAgICB0aGlzLmRhdGFMb2FkaW5nID0gdHJ1ZTtcclxuICAgICAgICAgICAgZXNyaVJlcXVlc3QodGhpcy51cmwsIHtcclxuICAgICAgICAgICAgICAgIHJlc3BvbnNlVHlwZTogXCJqc29uXCJcclxuICAgICAgICAgICAgfSlcclxuICAgICAgICAgICAgICAgIC50aGVuKChyZXNwb25zZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2RhdGFGZXRjaFJlcXVpcmVkID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fd2luZHkuc2V0RGF0YShyZXNwb25zZS5kYXRhKVxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2RvRHJhdygpOyAvLyBhbGwgc29ydGVkIGRyYXcgbm93LlxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZGF0YUxvYWRpbmcgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgICAgICAub3RoZXJ3aXNlKChlcnIpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3Igb2NjdXJyZWQgcmV0cmlldmluZyBkYXRhLiBcIiArIGVycik7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5kYXRhTG9hZGluZyA9IGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAvLyBubyBuZWVkIGZvciBkYXRhLCBqdXN0IGRyYXcuXHJcbiAgICAgICAgICAgIHRoaXMuX2RvRHJhdygpO1xyXG5cclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBVcGRhdGUgdGhlIGFjdGl2ZSB2aWV3LiBUaGUgdmlldyBtdXN0IGhhdmUgYmVlbiBhc3NpZ25lZCB0byB0aGUgbWFwIHByZXZpb3VzbHkgc28gdGhhdCB0aGlzIGxheWVyIGhhcyBjcmVhdGVkIG9yIHVzZWQgdGhlIGNhbnZhcyBlbGVtZW50IGluIGxheWVydmlldyBjcmVhdGVkIGFscmVhZHkuXHJcbiAgICAgKiBAcGFyYW0gdmlld1xyXG4gICAgICovXHJcbiAgICBzZXRWaWV3KHZpZXc6IE1hcFZpZXcgfCBTY2VuZVZpZXcpIHtcclxuICAgICAgICB0aGlzLl9hY3RpdmVWaWV3ID0gdmlldztcclxuICAgICAgICB0aGlzLmRyYXcoKTtcclxuICAgIH1cclxuXHJcbiAgICBzdG9wKCkge1xyXG4gICAgICAgIGlmICh0aGlzLl93aW5keSkge1xyXG4gICAgICAgICAgICB0aGlzLl93aW5keS5zdG9wKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHN0YXJ0KCkge1xyXG4gICAgICAgIHRoaXMuZHJhdygpO1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICAvKipcclxuICAgICAqIElzIHRoZSBhY3RpdmUgdmlldyAyZC5cclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBfaXMyZCgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5fYWN0aXZlVmlldyA/IHRoaXMuX2FjdGl2ZVZpZXcudHlwZSA9PT0gXCIyZFwiIDogZmFsc2U7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDYWxsIHRoZSB3aW5keSBkcmF3IG1ldGhvZFxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF9kb0RyYXcoKSB7XHJcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLl9pczJkKCkpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuX3dpbmR5LnN0YXJ0KFxyXG4gICAgICAgICAgICAgICAgICAgIFtbMCwgMF0sIFt0aGlzLl9jYW52YXMyZC53aWR0aCwgdGhpcy5fY2FudmFzMmQuaGVpZ2h0XV0sXHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fY2FudmFzMmQud2lkdGgsXHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fY2FudmFzMmQuaGVpZ2h0LFxyXG4gICAgICAgICAgICAgICAgICAgIFtbdGhpcy5fc291dGhXZXN0LngsIHRoaXMuX3NvdXRoV2VzdC55XSwgW3RoaXMuX25vcnRoRWFzdC54LCB0aGlzLl9ub3J0aEVhc3QueV1dXHJcbiAgICAgICAgICAgICAgICApO1xyXG5cclxuICAgICAgICAgICAgICAgIHRoaXMuX3NldERhdGUoKTtcclxuXHJcbiAgICAgICAgICAgICAgICB0aGlzLl9pc0RyYXdpbmcgPSBmYWxzZTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyBpZiB3ZSBoYXZlIGEgcXVldWVkIGRyYXcgZG8gaXQgcmlnaHQgbm93LlxyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX3F1ZXVlZERyYXcpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9xdWV1ZWREcmF3ID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5kcmF3KCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LCA1MDApO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogSW5pdCB0aGUgd2luZHkgY2xhc3MgXHJcbiAgICAgKiBAcGFyYW0gZGF0YVxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF9pbml0V2luZHkoZGF0YT8pIHtcclxuICAgICAgICBpZiAodGhpcy5faXMyZCgpKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3dpbmR5ID0gbmV3IFdpbmR5KFxyXG4gICAgICAgICAgICAgICAgdGhpcy5fY2FudmFzMmQsXHJcbiAgICAgICAgICAgICAgICB1bmRlZmluZWQsXHJcbiAgICAgICAgICAgICAgICB0aGlzLmRpc3BsYXlPcHRpb25zKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBTZXR1cCB0aGUgZ2VvIGJvdW5kcyBvZiB0aGUgZHJhd2luZyBhcmVhXHJcbiAgICAgKiBAcGFyYW0gd2lkdGhcclxuICAgICAqIEBwYXJhbSBoZWlnaHRcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBfc2V0dXBEcmF3KHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyKSB7XHJcblxyXG4gICAgICAgIC8vIHVzZSB0aGUgZXh0ZW50IG9mIHRoZSB2aWV3LCBhbmQgbm90IHRoZSBleHRlbnQgcGFzc2VkIGludG8gZmV0Y2hJbWFnZS4uLml0IHdhcyBzbGlnaHRseSBvZmYgd2hlbiBpdCBjcm9zc2VkIElETC5cclxuICAgICAgICBsZXQgZXh0ZW50ID0gdGhpcy5fYWN0aXZlVmlldy5leHRlbnQ7XHJcbiAgICAgICAgaWYgKGV4dGVudC5zcGF0aWFsUmVmZXJlbmNlLmlzV2ViTWVyY2F0b3IpIHtcclxuICAgICAgICAgICAgZXh0ZW50ID0gPEV4dGVudD53ZWJNZXJjYXRvclV0aWxzLndlYk1lcmNhdG9yVG9HZW9ncmFwaGljKGV4dGVudCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLl9ub3J0aEVhc3QgPSBuZXcgUG9pbnQoeyB4OiBleHRlbnQueG1heCwgeTogZXh0ZW50LnltYXggfSk7XHJcbiAgICAgICAgdGhpcy5fc291dGhXZXN0ID0gbmV3IFBvaW50KHsgeDogZXh0ZW50LnhtaW4sIHk6IGV4dGVudC55bWluIH0pO1xyXG5cclxuICAgICAgICBpZiAodGhpcy5faXMyZCgpKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2NhbnZhczJkLndpZHRoID0gd2lkdGg7XHJcbiAgICAgICAgICAgIHRoaXMuX2NhbnZhczJkLmhlaWdodCA9IGhlaWdodDtcclxuICAgICAgICAgICAgLy8gY2F0ZXIgZm9yIHRoZSBleHRlbnQgY3Jvc3NpbmcgdGhlIElETFxyXG4gICAgICAgICAgICBpZiAodGhpcy5fc291dGhXZXN0LnggPiB0aGlzLl9ub3J0aEVhc3QueCAmJiB0aGlzLl9ub3J0aEVhc3QueCA8IDApIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuX25vcnRoRWFzdC54ID0gMzYwICsgdGhpcy5fbm9ydGhFYXN0Lng7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBIYW5kbGUgbGF5ZXIgdmlldyBjcmVhdGVkLlxyXG4gICAgICogQHBhcmFtIGV2dFxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF9sYXllclZpZXdDcmVhdGVkKGV2dCkge1xyXG4gICAgICAgIC8vIHNldCB0aGUgYWN0aXZlIHZpZXcgdG8gdGhlIGZpcnN0IHZpZXcgbG9hZGVkIGlmIHRoZXJlIHdhc24ndCBvbmUgaW5jbHVkZWQgaW4gdGhlIGNvbnN0cnVjdG9yIHByb3BlcnRpZXMuXHJcbiAgICAgICAgdGhpcy5fdmlld0xvYWRDb3VudCsrO1xyXG4gICAgICAgIGlmICh0aGlzLl92aWV3TG9hZENvdW50ID09PSAxICYmICF0aGlzLl9hY3RpdmVWaWV3KSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2FjdGl2ZVZpZXcgPSBldnQubGF5ZXJWaWV3LnZpZXc7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAodGhpcy5faXMyZCgpKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2xheWVyVmlldzJkID0gZXZ0LmxheWVyVmlldztcclxuICAgICAgICAgICAgLy8gZm9yIG1hcCB2aWV3cywgd2FpdCBmb3IgdGhlIGxheWVydmlldyB0byBiZSBhdHRhY2hlZFxyXG4gICAgICAgICAgICB3YXRjaFV0aWxzLndoZW5UcnVlT25jZShldnQubGF5ZXJWaWV3LCBcImF0dGFjaGVkXCIsICgpID0+IHRoaXMuX2NyZWF0ZUNhbnZhcyhldnQubGF5ZXJWaWV3KSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLl9sYXllclZpZXczZCA9IGV2dC5sYXllclZpZXc7XHJcbiAgICAgICAgICAgIHRoaXMuX2NyZWF0ZUNhbnZhcyhldnQubGF5ZXJWaWV3KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgd2F0Y2hVdGlscy5wYXVzYWJsZShldnQubGF5ZXJWaWV3LnZpZXcsIFwic3RhdGlvbmFyeVwiLCAoaXNTdGF0aW9uYXJ5LCBiLCBjLCB2aWV3KSA9PiB0aGlzLl92aWV3U3RhdGlvbmFyeShpc1N0YXRpb25hcnksIGIsIGMsIHZpZXcpKTtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMucmVwb3J0VmFsdWVzID09PSB0cnVlKSB7XHJcbiAgICAgICAgICAgIGV2dC5sYXllclZpZXcudmlldy5vbihcInBvaW50ZXItbW92ZVwiLCAoZXZ0KSA9PiB0aGlzLl92aWV3UG9pbnRlck1vdmUoZXZ0KSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZSBvciBhc3NpZ24gYSBjYW52YXMgZWxlbWVudCBmb3IgdXNlIGluIGRyYXdpbmcuXHJcbiAgICAgKiBAcGFyYW0gbGF5ZXJWaWV3XHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgX2NyZWF0ZUNhbnZhcyhsYXllclZpZXcpIHtcclxuICAgICAgICBpZiAodGhpcy5faXMyZCgpKSB7XHJcbiAgICAgICAgICAgIC8vIEZvciBhIG1hcCB2aWV3IGdldCB0aGUgY29udGFpbmVyIGVsZW1lbnQgb2YgdGhlIGxheWVyIHZpZXcgYW5kIGFkZCBhIGNhbnZhcyB0byBpdC5cclxuICAgICAgICAgICAgdGhpcy5fY2FudmFzMmQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiY2FudmFzXCIpO1xyXG4gICAgICAgICAgICBsYXllclZpZXcuY29udGFpbmVyLmVsZW1lbnQuYXBwZW5kQ2hpbGQodGhpcy5fY2FudmFzMmQpO1xyXG5cclxuICAgICAgICAgICAgLy8gZGVmYXVsdCBzb21lIHN0eWxlcyBcclxuICAgICAgICAgICAgdGhpcy5fY2FudmFzMmQuc3R5bGUucG9zaXRpb24gPSBcImFic29sdXRlXCI7XHJcbiAgICAgICAgICAgIHRoaXMuX2NhbnZhczJkLnN0eWxlLmxlZnQgPSBcIjBcIjtcclxuICAgICAgICAgICAgdGhpcy5fY2FudmFzMmQuc3R5bGUudG9wID0gXCIwXCI7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAvLyBIYW5kbGUgc2NlbmUgdmlldyBjYW52YXMgaW4gZnV0dXJlLiAgICAgICAgICAgIFxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gc2V0dXAgd2luZHkgb25jZSB0aGUgY2FudmFzIGhhcyBiZWVuIGNyZWF0ZWRcclxuICAgICAgICB0aGlzLl9pbml0V2luZHkoKTtcclxuICAgIH1cclxuXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiB2aWV3IHN0YXRpb25hcnkgaGFuZGxlciwgY2xlYXIgY2FudmFzIG9yIGZvcmNlIGEgcmVkcmF3XHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgX3ZpZXdTdGF0aW9uYXJ5KGlzU3RhdGlvbmFyeSwgYiwgYywgdmlldykge1xyXG4gICAgICAgIGlmICghdGhpcy5fYWN0aXZlVmlldykgcmV0dXJuO1xyXG5cclxuICAgICAgICBpZiAoIWlzU3RhdGlvbmFyeSkge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5fd2luZHkpIHtcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9pczJkKCkpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl93aW5keS5zdG9wKCk7IC8vIGZvcmNlIGEgc3RvcCBvZiB3aW5keSB3aGVuIHZpZXcgaXMgbW92aW5nXHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fY2FudmFzMmQuZ2V0Q29udGV4dChcIjJkXCIpLmNsZWFyUmVjdCgwLCAwLCB0aGlzLl9hY3RpdmVWaWV3LndpZHRoLCB0aGlzLl9hY3RpdmVWaWV3LmhlaWdodCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLl9pc0RyYXdpbmcpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuX3F1ZXVlZERyYXcgPSB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2Uge1xyXG5cclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmRpc3BsYXlPcHRpb25zLnBhcnRpY2xlTXVsdGlwbGllckJ5Wm9vbSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3NldFBhcnRpY2xlTXVsdGlwbGllcigpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIHRoaXMuZHJhdygpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX3NldFBhcnRpY2xlTXVsdGlwbGllcigpIHtcclxuICAgICAgICBsZXQgY3VycmVudFpvb20gPSB0aGlzLl9hY3RpdmVWaWV3Lnpvb207XHJcbiAgICAgICAgbGV0IGJhc2Vab29tID0gdGhpcy5kaXNwbGF5T3B0aW9ucy5wYXJ0aWNsZU11bHRpcGxpZXJCeVpvb20uem9vbUxldmVsO1xyXG4gICAgICAgIGxldCBwbSA9IHRoaXMuZGlzcGxheU9wdGlvbnMucGFydGljbGVNdWx0aXBsaWVyQnlab29tLnBhcnRpY2xlTXVsdGlwbGllcjtcclxuXHJcbiAgICAgICAgaWYgKGN1cnJlbnRab29tID4gYmFzZVpvb20pIHtcclxuICAgICAgICAgICAgbGV0IHpvb21EaWZmID0gKGN1cnJlbnRab29tIC0gYmFzZVpvb20pO1xyXG4gICAgICAgICAgICBwbSA9IHRoaXMuZGlzcGxheU9wdGlvbnMucGFydGljbGVNdWx0aXBsaWVyQnlab29tLnBhcnRpY2xlTXVsdGlwbGllciAtICh6b29tRGlmZiAqIHRoaXMuZGlzcGxheU9wdGlvbnMucGFydGljbGVNdWx0aXBsaWVyQnlab29tLmRpZmZSYXRpbyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2UgaWYgKGN1cnJlbnRab29tIDwgYmFzZVpvb20pIHtcclxuICAgICAgICAgICAgbGV0IHpvb21EaWZmID0gYmFzZVpvb20gLSBjdXJyZW50Wm9vbTtcclxuICAgICAgICAgICAgcG0gPSB0aGlzLmRpc3BsYXlPcHRpb25zLnBhcnRpY2xlTXVsdGlwbGllckJ5Wm9vbS5wYXJ0aWNsZU11bHRpcGxpZXIgKyAoem9vbURpZmYgKiB0aGlzLmRpc3BsYXlPcHRpb25zLnBhcnRpY2xlTXVsdGlwbGllckJ5Wm9vbS5kaWZmUmF0aW8pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHBtIDwgdGhpcy5kaXNwbGF5T3B0aW9ucy5wYXJ0aWNsZU11bHRpcGxpZXJCeVpvb20ubWluTXVsdGlwbGllcikgcG0gPSB0aGlzLmRpc3BsYXlPcHRpb25zLnBhcnRpY2xlTXVsdGlwbGllckJ5Wm9vbS5taW5NdWx0aXBsaWVyO1xyXG4gICAgICAgIGVsc2UgaWYgKHBtID4gdGhpcy5kaXNwbGF5T3B0aW9ucy5wYXJ0aWNsZU11bHRpcGxpZXJCeVpvb20ubWF4TXVsdGlwbGllcikgcG0gPSB0aGlzLmRpc3BsYXlPcHRpb25zLnBhcnRpY2xlTXVsdGlwbGllckJ5Wm9vbS5tYXhNdWx0aXBsaWVyO1xyXG5cclxuICAgICAgICBpZiAodGhpcy5faXMyZCgpICYmIHRoaXMuX3dpbmR5KSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3dpbmR5LlBBUlRJQ0xFX01VTFRJUExJRVIgPSBwbTtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coY3VycmVudFpvb20gKyBcIiAtIFwiICsgcG0pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfdmlld1BvaW50ZXJNb3ZlKGV2dCkge1xyXG4gICAgICAgIGlmICghdGhpcy5fd2luZHkgfHwgIXRoaXMudmlzaWJsZSkgcmV0dXJuO1xyXG5cclxuICAgICAgICBsZXQgbW91c2VQb3MgPSB0aGlzLl9nZXRNb3VzZVBvcyhldnQpO1xyXG4gICAgICAgIGxldCBwb2ludCA9IHRoaXMuX2FjdGl2ZVZpZXcudG9NYXAoeyB4OiBtb3VzZVBvcy54LCB5OiBtb3VzZVBvcy55IH0pO1xyXG4gICAgICAgIGlmIChwb2ludC5zcGF0aWFsUmVmZXJlbmNlLmlzV2ViTWVyY2F0b3IpIHtcclxuICAgICAgICAgICAgcG9pbnQgPSA8UG9pbnQ+d2ViTWVyY2F0b3JVdGlscy53ZWJNZXJjYXRvclRvR2VvZ3JhcGhpYyhwb2ludCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgZ3JpZCA9IHRoaXMuX3dpbmR5LmludGVycG9sYXRlKHBvaW50LngsIHBvaW50LnkpO1xyXG4gICAgICAgIGxldCByZXN1bHQ6IFBvaW50UmVwb3J0ID0ge1xyXG4gICAgICAgICAgICBwb2ludDogcG9pbnQsXHJcbiAgICAgICAgICAgIHRhcmdldDogdGhpc1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGlmICghZ3JpZCB8fCAoaXNOYU4oZ3JpZFswXSkgfHwgaXNOYU4oZ3JpZFsxXSkgfHwgIWdyaWRbMl0pKSB7XHJcbiAgICAgICAgICAgIC8vIHRoZSBjdXJyZW50IHBvaW50IGNvbnRhaW5zIG5vIGRhdGEgaW4gdGhlIHdpbmR5IGdyaWQsIHNvIGVtaXQgYW4gb2JqZWN0IHdpdGggbm8gc3BlZWQgb3IgZGlyZWN0aW9uIG9iamVjdFxyXG4gICAgICAgICAgICB0aGlzLmVtaXQoXCJwb2ludC1yZXBvcnRcIiwgcmVzdWx0KTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gZ2V0IHRoZSBzcGVlZCBhbmQgZGlyZWN0aW9uIGFuZCBlbWl0IHRoZSByZXN1bHRcclxuICAgICAgICByZXN1bHQudmVsb2NpdHkgPSB0aGlzLl92ZWN0b3JUb1NwZWVkKGdyaWRbMF0sIGdyaWRbMV0pO1xyXG4gICAgICAgIHJlc3VsdC5kZWdyZWUgPSB0aGlzLl92ZWN0b3JUb0RlZ3JlZXMoZ3JpZFswXSwgZ3JpZFsxXSk7XHJcbiAgICAgICAgdGhpcy5lbWl0KFwicG9pbnQtcmVwb3J0XCIsIHJlc3VsdCk7XHJcblxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ29udmVydCB0aGUgd2luZHkgdmVjdG9yIGRhdGEgdG8gbWV0ZXJzIHBlciBzZWNvbmRcclxuICAgICAqIEBwYXJhbSB1TXNcclxuICAgICAqIEBwYXJhbSB2TXNcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBfdmVjdG9yVG9TcGVlZCh1TXMsIHZNcykge1xyXG4gICAgICAgIGxldCBzcGVlZEFicyA9IE1hdGguc3FydChNYXRoLnBvdyh1TXMsIDIpICsgTWF0aC5wb3codk1zLCAyKSk7XHJcbiAgICAgICAgcmV0dXJuIHNwZWVkQWJzO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmV0dXJuIHRoZSB3aW5keSB2ZWN0b3IgZGF0YSBhcyBhIGRpcmVjdGlvbi4gUmV0dXJucyB0aGUgZGlyZWN0aW9uIG9mIHRoZSBmbG93IG9mIHRoZSBkYXRhIHdpdGggdGhlIGRlZ3JlZXMgaW4gYSBjbG9ja3dpc2UgZGlyZWN0aW9uLlxyXG4gICAgICogQHBhcmFtIHVNc1xyXG4gICAgICogQHBhcmFtIHZNc1xyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF92ZWN0b3JUb0RlZ3JlZXModU1zLCB2TXMpIHtcclxuXHJcbiAgICAgICAgbGV0IGFicyA9IE1hdGguc3FydChNYXRoLnBvdyh1TXMsIDIpICsgTWF0aC5wb3codk1zLCAyKSk7XHJcbiAgICAgICAgbGV0IGRpcmVjdGlvbiA9IE1hdGguYXRhbjIodU1zIC8gYWJzLCB2TXMgLyBhYnMpO1xyXG4gICAgICAgIGxldCBkaXJlY3Rpb25Ub0RlZ3JlZXMgPSBkaXJlY3Rpb24gKiAxODAgLyBNYXRoLlBJICsgMTgwO1xyXG5cclxuICAgICAgICBkaXJlY3Rpb25Ub0RlZ3JlZXMgKz0gMTgwO1xyXG4gICAgICAgIGlmIChkaXJlY3Rpb25Ub0RlZ3JlZXMgPj0gMzYwKSBkaXJlY3Rpb25Ub0RlZ3JlZXMgLT0gMzYwO1xyXG5cclxuICAgICAgICByZXR1cm4gZGlyZWN0aW9uVG9EZWdyZWVzO1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICBwcml2YXRlIF9nZXRNb3VzZVBvcyhldnQpIHtcclxuICAgICAgICAvLyBjb250YWluZXIgb24gdGhlIHZpZXcgaXMgYWN0dWFsbHkgYSBodG1sIGVsZW1lbnQgYXQgdGhpcyBwb2ludCwgbm90IGEgc3RyaW5nIGFzIHRoZSB0eXBpbmdzIHN1Z2dlc3QuXHJcbiAgICAgICAgbGV0IGNvbnRhaW5lcjogYW55ID0gdGhpcy5fYWN0aXZlVmlldy5jb250YWluZXI7XHJcbiAgICAgICAgbGV0IHJlY3QgPSBjb250YWluZXIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgeDogZXZ0LnggLSByZWN0LmxlZnQsXHJcbiAgICAgICAgICAgIHk6IGV2dC55IC0gcmVjdC50b3BcclxuICAgICAgICB9O1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICAvKipcclxuICAgICAqIFdhdGNoIG9mIHRoZSB1cmwgcHJvcGVydHkgLSBjYWxsIGRyYXcgYWdhaW4gd2l0aCBhIHJlZmV0Y2hcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBfdXJsQ2hhbmdlZChhLCBiLCBjLCBkKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuX3dpbmR5KSB0aGlzLl93aW5keS5zdG9wKCk7XHJcbiAgICAgICAgdGhpcy5fZGF0YUZldGNoUmVxdWlyZWQgPSB0cnVlO1xyXG4gICAgICAgIHRoaXMuZHJhdygpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogV2F0Y2ggb2YgdGhlIHVybCBwcm9wZXJ0eSAtIGNhbGwgZHJhdyBhZ2FpbiB3aXRoIGEgcmVmZXRjaFxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF92aXNpYmxlQ2hhbmdlZCh2aXNpYmxlLCBiLCBjLCBkKSB7XHJcbiAgICAgICAgaWYgKCF2aXNpYmxlKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLl93aW5keSkgdGhpcy5fd2luZHkuc3RvcCgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5kcmF3KCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFdhdGNoIG9mIGRpc3BsYXlPcHRpb25zIC0gY2FsbCBkcmF3IGFnYWluIHdpdGggbmV3IG9wdGlvbnMgc2V0IG9uIHdpbmR5LlxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF9kaXNwbGF5T3B0aW9uc0NoYW5nZWQobmV3T3B0aW9ucywgYiwgYywgZCkge1xyXG4gICAgICAgIGlmICghdGhpcy5fd2luZHkpIHJldHVybjtcclxuICAgICAgICB0aGlzLl93aW5keS5zdG9wKCk7XHJcbiAgICAgICAgdGhpcy5fd2luZHkuc2V0RGlzcGxheU9wdGlvbnMobmV3T3B0aW9ucyk7XHJcbiAgICAgICAgdGhpcy5kcmF3KCk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfc2V0RGF0ZSgpIHtcclxuICAgICAgICBpZiAodGhpcy5faXMyZCgpICYmIHRoaXMuX3dpbmR5KSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLl93aW5keS5yZWZUaW1lICYmIHRoaXMuX3dpbmR5LmZvcmVjYXN0VGltZSkge1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIGFzc3VtZSB0aGUgcmVmIHRpbWUgaXMgYW4gaXNvIHN0cmluZywgb3Igc29tZSBvdGhlciBlcXVpdmFsZW50IHRoYXQgamF2YXNjcmlwdCBEYXRlIG9iamVjdCBjYW4gcGFyc2UuXHJcbiAgICAgICAgICAgICAgICBsZXQgZCA9IG5ldyBEYXRlKHRoaXMuX3dpbmR5LnJlZlRpbWUpO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIGFkZCB0aGUgZm9yZWNhc3QgdGltZSBhcyBob3VycyB0byB0aGUgcmVmVGltZTtcclxuICAgICAgICAgICAgICAgIGQuc2V0SG91cnMoZC5nZXRIb3VycygpICsgdGhpcy5fd2luZHkuZm9yZWNhc3RUaW1lKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuZGF0ZSA9IGQ7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuZGF0ZSA9IHVuZGVmaW5lZDtcclxuICAgIH1cclxufVxyXG5cclxuXHJcblxyXG4vKiAgR2xvYmFsIGNsYXNzIGZvciBzaW11bGF0aW5nIHRoZSBtb3ZlbWVudCBvZiBwYXJ0aWNsZSB0aHJvdWdoIGdyaWRcclxuIGNyZWRpdDogQWxsIHRoZSBjcmVkaXQgZm9yIHRoaXMgd29yayBnb2VzIHRvOiBodHRwczovL2dpdGh1Yi5jb20vY2FtYmVjYyBmb3IgY3JlYXRpbmcgdGhlIHJlcG86XHJcbiBodHRwczovL2dpdGh1Yi5jb20vY2FtYmVjYy9lYXJ0aC4gVGhlIG1ham9yaXR5IG9mIHRoaXMgY29kZSBpcyBkaXJlY3RseSB0YWtlbiBmcm9tIHRoZXJlLCBzaW5jZSBpdHMgYXdlc29tZS5cclxuIFRoaXMgY2xhc3MgdGFrZXMgYSBjYW52YXMgZWxlbWVudCBhbmQgYW4gYXJyYXkgb2YgZGF0YSAoMWttIEdGUyBmcm9tIGh0dHA6Ly93d3cuZW1jLm5jZXAubm9hYS5nb3YvaW5kZXgucGhwP2JyYW5jaD1HRlMpXHJcbiBhbmQgdGhlbiB1c2VzIGEgbWVyY2F0b3IgKGZvcndhcmQvcmV2ZXJzZSkgcHJvamVjdGlvbiB0byBjb3JyZWN0bHkgbWFwIHdpbmQgdmVjdG9ycyBpbiBcIm1hcCBzcGFjZVwiLlxyXG4gVGhlIFwic3RhcnRcIiBtZXRob2QgdGFrZXMgdGhlIGJvdW5kcyBvZiB0aGUgbWFwIGF0IGl0cyBjdXJyZW50IGV4dGVudCBhbmQgc3RhcnRzIHRoZSB3aG9sZSBncmlkZGluZyxcclxuIGludGVycG9sYXRpb24gYW5kIGFuaW1hdGlvbiBwcm9jZXNzLlxyXG4gRXh0cmEgY3JlZGl0IHRvIGh0dHBzOi8vZ2l0aHViLmNvbS9kYW53aWxkL2xlYWZsZXQtdmVsb2NpdHkgZm9yIG1vZGlmeWluZyB0aGUgY2xhc3MgdG8gYmUgbW9yZSBjdXN0b21pemFibGUgYW5kIHJldXNhYmxlIGZvciBvdGhlciBzY2VuYXJpb3MuXHJcbiBBbHNvIGNyZWRpdCB0byAtIGh0dHBzOi8vZ2l0aHViLmNvbS9Fc3JpL3dpbmQtanMgXHJcbiAqL1xyXG5jbGFzcyBXaW5keSB7XHJcblxyXG4gICAgTUlOX1ZFTE9DSVRZX0lOVEVOU0lUWTogbnVtYmVyO1xyXG4gICAgTUFYX1ZFTE9DSVRZX0lOVEVOU0lUWTogbnVtYmVyO1xyXG4gICAgVkVMT0NJVFlfU0NBTEU6IG51bWJlcjtcclxuICAgIE1BWF9QQVJUSUNMRV9BR0U6IG51bWJlcjtcclxuICAgIFBBUlRJQ0xFX0xJTkVfV0lEVEg6IG51bWJlcjtcclxuICAgIFBBUlRJQ0xFX01VTFRJUExJRVI6IG51bWJlcjtcclxuICAgIFBBUlRJQ0xFX1JFRFVDVElPTjogbnVtYmVyO1xyXG4gICAgRlJBTUVfUkFURTogbnVtYmVyO1xyXG4gICAgRlJBTUVfVElNRTogbnVtYmVyO1xyXG4gICAgY29sb3JTY2FsZTogYW55O1xyXG4gICAgY2FudmFzOiBIVE1MQ2FudmFzRWxlbWVudDtcclxuXHJcbiAgICBmb3JlY2FzdFRpbWU6IG51bWJlcjtcclxuICAgIHJlZlRpbWU6IHN0cmluZztcclxuXHJcbiAgICBOVUxMX1dJTkRfVkVDVE9SID0gW05hTiwgTmFOLCBudWxsXTsgLy8gc2luZ2xldG9uIGZvciBubyB3aW5kIGluIHRoZSBmb3JtOiBbdSwgdiwgbWFnbml0dWRlXVxyXG5cclxuICAgIHN0YXRpYyBmaWVsZDogYW55O1xyXG4gICAgc3RhdGljIGFuaW1hdGlvbkxvb3A7XHJcblxyXG4gICAgYnVpbGRlcjtcclxuICAgIGdyaWQ7XHJcbiAgICBncmlkRGF0YTogYW55O1xyXG4gICAgZGF0ZTtcclxuICAgIM67MDtcclxuICAgIM+GMDtcclxuICAgIM6Uzrs7XHJcbiAgICDOlM+GO1xyXG4gICAgbmk7XHJcbiAgICBuajtcclxuXHJcbiAgICBwcml2YXRlIF9zY2FuTW9kZTogbnVtYmVyO1xyXG4gICAgcHJpdmF0ZSBfZHluYW1pY1BhcnRpY2xlTXVsdGlwbGllcjogYm9vbGVhbjtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihjYW52YXM6IEhUTUxDYW52YXNFbGVtZW50LCBkYXRhPzogYW55LCBvcHRpb25zPzogRGlzcGxheU9wdGlvbnMpIHtcclxuXHJcbiAgICAgICAgdGhpcy5jYW52YXMgPSBjYW52YXM7XHJcbiAgICAgICAgaWYgKCFvcHRpb25zKSBvcHRpb25zID0ge307XHJcbiAgICAgICAgdGhpcy5zZXREaXNwbGF5T3B0aW9ucyhvcHRpb25zKTtcclxuICAgICAgICB0aGlzLmdyaWREYXRhID0gZGF0YTtcclxuXHJcbiAgICB9XHJcblxyXG4gICAgc2V0RGF0YShkYXRhKSB7XHJcbiAgICAgICAgdGhpcy5ncmlkRGF0YSA9IGRhdGE7XHJcbiAgICB9XHJcblxyXG4gICAgc2V0RGlzcGxheU9wdGlvbnMob3B0aW9uczogRGlzcGxheU9wdGlvbnMpIHtcclxuICAgICAgICB0aGlzLk1JTl9WRUxPQ0lUWV9JTlRFTlNJVFkgPSBvcHRpb25zLm1pblZlbG9jaXR5IHx8IDA7IC8vIHZlbG9jaXR5IGF0IHdoaWNoIHBhcnRpY2xlIGludGVuc2l0eSBpcyBtaW5pbXVtIChtL3MpXHJcbiAgICAgICAgdGhpcy5NQVhfVkVMT0NJVFlfSU5URU5TSVRZID0gb3B0aW9ucy5tYXhWZWxvY2l0eSB8fCAxMDsgLy8gdmVsb2NpdHkgYXQgd2hpY2ggcGFydGljbGUgaW50ZW5zaXR5IGlzIG1heGltdW0gKG0vcylcclxuICAgICAgICB0aGlzLlZFTE9DSVRZX1NDQUxFID0gKG9wdGlvbnMudmVsb2NpdHlTY2FsZSB8fCAwLjAwNSkgKiAoTWF0aC5wb3cod2luZG93LmRldmljZVBpeGVsUmF0aW8sIDEgLyAzKSB8fCAxKTsgLy8gc2NhbGUgZm9yIHdpbmQgdmVsb2NpdHkgKGNvbXBsZXRlbHkgYXJiaXRyYXJ5LS10aGlzIHZhbHVlIGxvb2tzIG5pY2UpXHJcbiAgICAgICAgdGhpcy5NQVhfUEFSVElDTEVfQUdFID0gb3B0aW9ucy5wYXJ0aWNsZUFnZSB8fCA5MDsgLy8gbWF4IG51bWJlciBvZiBmcmFtZXMgYSBwYXJ0aWNsZSBpcyBkcmF3biBiZWZvcmUgcmVnZW5lcmF0aW9uXHJcbiAgICAgICAgdGhpcy5QQVJUSUNMRV9MSU5FX1dJRFRIID0gb3B0aW9ucy5saW5lV2lkdGggfHwgMTsgLy8gbGluZSB3aWR0aCBvZiBhIGRyYXduIHBhcnRpY2xlXHJcblxyXG4gICAgICAgIC8vIGRlZmF1bHQgcGFydGljbGUgbXVsdGlwbGllciB0byAyXHJcbiAgICAgICAgdGhpcy5QQVJUSUNMRV9NVUxUSVBMSUVSID0gb3B0aW9ucy5wYXJ0aWNsZU11bHRpcGxpZXIgfHwgMjtcclxuXHJcbiAgICAgICAgdGhpcy5QQVJUSUNMRV9SRURVQ1RJT04gPSBNYXRoLnBvdyh3aW5kb3cuZGV2aWNlUGl4ZWxSYXRpbywgMSAvIDMpIHx8IDEuNjsgLy8gbXVsdGlwbHkgcGFydGljbGUgY291bnQgZm9yIG1vYmlsZXMgYnkgdGhpcyBhbW91bnRcclxuICAgICAgICB0aGlzLkZSQU1FX1JBVEUgPSBvcHRpb25zLmZyYW1lUmF0ZSB8fCAxNTtcclxuICAgICAgICB0aGlzLkZSQU1FX1RJTUUgPSAxMDAwIC8gdGhpcy5GUkFNRV9SQVRFOyAvLyBkZXNpcmVkIGZyYW1lcyBwZXIgc2Vjb25kXHJcblxyXG4gICAgICAgIHZhciBkZWZhdWx0Q29sb3JTY2FsZSA9IFtcInJnYig2MSwxNjAsMjQ3KVwiLCBcInJnYig5OSwxNjQsMjE3KVwiLCBcInJnYigxMzgsMTY4LDE4OClcIiwgXCJyZ2IoMTc3LDE3MywxNTgpXCIsIFwicmdiKDIxNiwxNzcsMTI5KVwiLCBcInJnYigyNTUsMTgyLDEwMClcIiwgXCJyZ2IoMjQwLDE0NSw4NylcIiwgXCJyZ2IoMjI1LDEwOSw3NClcIiwgXCJyZ2IoMjEwLDcyLDYxKVwiLCBcInJnYigxOTUsMzYsNDgpXCIsIFwicmdiKDE4MCwwLDM1KVwiXTtcclxuICAgICAgICB0aGlzLmNvbG9yU2NhbGUgPSBvcHRpb25zLmNvbG9yU2NhbGUgfHwgZGVmYXVsdENvbG9yU2NhbGU7XHJcbiAgICB9XHJcblxyXG4gICAgc3RhcnQoYm91bmRzLCB3aWR0aCwgaGVpZ2h0LCBleHRlbnQpIHtcclxuXHJcbiAgICAgICAgbGV0IG1hcEJvdW5kcyA9IHtcclxuICAgICAgICAgICAgc291dGg6IHRoaXMuZGVnMnJhZChleHRlbnRbMF1bMV0pLFxyXG4gICAgICAgICAgICBub3J0aDogdGhpcy5kZWcycmFkKGV4dGVudFsxXVsxXSksXHJcbiAgICAgICAgICAgIGVhc3Q6IHRoaXMuZGVnMnJhZChleHRlbnRbMV1bMF0pLFxyXG4gICAgICAgICAgICB3ZXN0OiB0aGlzLmRlZzJyYWQoZXh0ZW50WzBdWzBdKSxcclxuICAgICAgICAgICAgd2lkdGg6IHdpZHRoLFxyXG4gICAgICAgICAgICBoZWlnaHQ6IGhlaWdodFxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHRoaXMuc3RvcCgpO1xyXG5cclxuICAgICAgICAvLyBidWlsZCBncmlkXHJcbiAgICAgICAgdGhpcy5idWlsZEdyaWQodGhpcy5ncmlkRGF0YSwgKGdyaWRSZXN1bHQpID0+IHtcclxuICAgICAgICAgICAgbGV0IGJ1aWx0Qm91bmRzID0gdGhpcy5idWlsZEJvdW5kcyhib3VuZHMsIHdpZHRoLCBoZWlnaHQpO1xyXG4gICAgICAgICAgICB0aGlzLmludGVycG9sYXRlRmllbGQoZ3JpZFJlc3VsdCwgYnVpbHRCb3VuZHMsIG1hcEJvdW5kcywgKGJvdW5kcywgZmllbGQpID0+IHtcclxuICAgICAgICAgICAgICAgIC8vIGFuaW1hdGUgdGhlIGNhbnZhcyB3aXRoIHJhbmRvbSBwb2ludHNcclxuICAgICAgICAgICAgICAgIFdpbmR5LmZpZWxkID0gZmllbGQ7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFuaW1hdGUoYm91bmRzLCBXaW5keS5maWVsZCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIHN0b3AoKSB7XHJcbiAgICAgICAgaWYgKFdpbmR5LmZpZWxkKSBXaW5keS5maWVsZC5yZWxlYXNlKCk7XHJcbiAgICAgICAgaWYgKFdpbmR5LmFuaW1hdGlvbkxvb3ApIGNhbmNlbEFuaW1hdGlvbkZyYW1lKFdpbmR5LmFuaW1hdGlvbkxvb3ApO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgKiBHZXQgaW50ZXJwb2xhdGVkIGdyaWQgdmFsdWUgZnJvbSBMb24vTGF0IHBvc2l0aW9uXHJcbiAgICogQHBhcmFtIM67IHtGbG9hdH0gTG9uZ2l0dWRlXHJcbiAgICogQHBhcmFtIM+GIHtGbG9hdH0gTGF0aXR1ZGVcclxuICAgKiBAcmV0dXJucyB7T2JqZWN0fVxyXG4gICAqL1xyXG4gICAgaW50ZXJwb2xhdGUozrssIM+GKSB7XHJcblxyXG4gICAgICAgIGlmICghdGhpcy5ncmlkKSByZXR1cm4gbnVsbDtcclxuXHJcbiAgICAgICAgbGV0IGkgPSB0aGlzLmZsb29yTW9kKM67IC0gdGhpcy7OuzAsIDM2MCkgLyB0aGlzLs6Uzrs7IC8vIGNhbGN1bGF0ZSBsb25naXR1ZGUgaW5kZXggaW4gd3JhcHBlZCByYW5nZSBbMCwgMzYwKVxyXG4gICAgICAgIGxldCBqID0gKHRoaXMuz4YwIC0gz4YpIC8gdGhpcy7OlM+GOyAvLyBjYWxjdWxhdGUgbGF0aXR1ZGUgaW5kZXggaW4gZGlyZWN0aW9uICs5MCB0byAtOTBcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuX3NjYW5Nb2RlID09PSA2NCkge1xyXG4gICAgICAgICAgICAvLyBjYWxjdWxhdGUgbGF0aXR1ZGUgaW5kZXggaW4gZGlyZWN0aW9uIC05MCB0byArOTAgYXMgdGhpcyBpcyBzY2FuIG1vZGUgNjRcclxuICAgICAgICAgICAgaiA9ICjPhiAtIHRoaXMuz4YwKSAvIHRoaXMuzpTPhjtcclxuICAgICAgICAgICAgaiA9IHRoaXMuZ3JpZC5sZW5ndGggLSBqO1xyXG4gICAgICAgIH1cclxuXHJcblxyXG4gICAgICAgIGxldCBmaSA9IE1hdGguZmxvb3IoaSksXHJcbiAgICAgICAgICAgIGNpID0gZmkgKyAxO1xyXG4gICAgICAgIGxldCBmaiA9IE1hdGguZmxvb3IoaiksXHJcbiAgICAgICAgICAgIGNqID0gZmogKyAxO1xyXG5cclxuICAgICAgICBsZXQgcm93O1xyXG4gICAgICAgIGlmIChyb3cgPSB0aGlzLmdyaWRbZmpdKSB7XHJcbiAgICAgICAgICAgIHZhciBnMDAgPSByb3dbZmldO1xyXG4gICAgICAgICAgICB2YXIgZzEwID0gcm93W2NpXTtcclxuICAgICAgICAgICAgaWYgKHRoaXMuaXNWYWx1ZShnMDApICYmIHRoaXMuaXNWYWx1ZShnMTApICYmIChyb3cgPSB0aGlzLmdyaWRbY2pdKSkge1xyXG4gICAgICAgICAgICAgICAgdmFyIGcwMSA9IHJvd1tmaV07XHJcbiAgICAgICAgICAgICAgICB2YXIgZzExID0gcm93W2NpXTtcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmlzVmFsdWUoZzAxKSAmJiB0aGlzLmlzVmFsdWUoZzExKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIEFsbCBmb3VyIHBvaW50cyBmb3VuZCwgc28gaW50ZXJwb2xhdGUgdGhlIHZhbHVlLlxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmJ1aWxkZXIuaW50ZXJwb2xhdGUoaSAtIGZpLCBqIC0gZmosIGcwMCwgZzEwLCBnMDEsIGcxMSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBidWlsZEdyaWQoZGF0YSwgY2FsbGJhY2spIHtcclxuXHJcbiAgICAgICAgdGhpcy5idWlsZGVyID0gdGhpcy5jcmVhdGVCdWlsZGVyKGRhdGEpO1xyXG4gICAgICAgIHZhciBoZWFkZXIgPSB0aGlzLmJ1aWxkZXIuaGVhZGVyO1xyXG5cclxuICAgICAgICB0aGlzLs67MCA9IGhlYWRlci5sbzE7XHJcbiAgICAgICAgdGhpcy7PhjAgPSBoZWFkZXIubGExOyAvLyB0aGUgZ3JpZCdzIG9yaWdpbiAoZS5nLiwgMC4wRSwgOTAuME4pXHJcblxyXG4gICAgICAgIHRoaXMuzpTOuyA9IGhlYWRlci5keDtcclxuICAgICAgICB0aGlzLs6Uz4YgPSBoZWFkZXIuZHk7IC8vIGRpc3RhbmNlIGJldHdlZW4gZ3JpZCBwb2ludHMgKGUuZy4sIDIuNSBkZWcgbG9uLCAyLjUgZGVnIGxhdClcclxuXHJcbiAgICAgICAgdGhpcy5uaSA9IGhlYWRlci5ueDtcclxuICAgICAgICB0aGlzLm5qID0gaGVhZGVyLm55OyAvLyBudW1iZXIgb2YgZ3JpZCBwb2ludHMgVy1FIGFuZCBOLVMgKGUuZy4sIDE0NCB4IDczKVxyXG5cclxuICAgICAgICB0aGlzLmRhdGUgPSBuZXcgRGF0ZShoZWFkZXIucmVmVGltZSk7XHJcbiAgICAgICAgdGhpcy5kYXRlLnNldEhvdXJzKHRoaXMuZGF0ZS5nZXRIb3VycygpICsgaGVhZGVyLmZvcmVjYXN0VGltZSk7XHJcblxyXG4gICAgICAgIHRoaXMuX3NjYW5Nb2RlID0gaGVhZGVyLnNjYW5Nb2RlO1xyXG5cclxuICAgICAgICB0aGlzLmdyaWQgPSBbXTtcclxuICAgICAgICB2YXIgcCA9IDA7XHJcbiAgICAgICAgdmFyIGlzQ29udGludW91cyA9IE1hdGguZmxvb3IodGhpcy5uaSAqIHRoaXMuzpTOuykgPj0gMzYwO1xyXG5cclxuICAgICAgICBpZiAoaGVhZGVyLnNjYW5Nb2RlID09PSAwKSB7XHJcbiAgICAgICAgICAgIC8vIFNjYW4gbW9kZSAwLiBMb25naXR1ZGUgaW5jcmVhc2VzIGZyb20gzrswLCBhbmQgbGF0aXR1ZGUgZGVjcmVhc2VzIGZyb20gz4YwLlxyXG4gICAgICAgICAgICAvLyBodHRwOi8vd3d3Lm5jby5uY2VwLm5vYWEuZ292L3BtYi9kb2NzL2dyaWIyL2dyaWIyX3RhYmxlMy00LnNodG1sXHJcblxyXG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHRoaXMubmo7IGorKykge1xyXG4gICAgICAgICAgICAgICAgbGV0IHJvdyA9IFtdO1xyXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLm5pOyBpKysgLCBwKyspIHtcclxuICAgICAgICAgICAgICAgICAgICByb3dbaV0gPSB0aGlzLmJ1aWxkZXIuZGF0YShwKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGlmIChpc0NvbnRpbnVvdXMpIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBGb3Igd3JhcHBlZCBncmlkcywgZHVwbGljYXRlIGZpcnN0IGNvbHVtbiBhcyBsYXN0IGNvbHVtbiB0byBzaW1wbGlmeSBpbnRlcnBvbGF0aW9uIGxvZ2ljXHJcbiAgICAgICAgICAgICAgICAgICAgcm93LnB1c2gocm93WzBdKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHRoaXMuZ3JpZFtqXSA9IHJvdztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIGlmIChoZWFkZXIuc2Nhbk1vZGUgPT09IDY0KSB7XHJcbiAgICAgICAgICAgIC8vIFNjYW4gbW9kZSAwLiBMb25naXR1ZGUgaW5jcmVhc2VzIGZyb20gzrswLCBhbmQgbGF0aXR1ZGUgaW5jcmVhc2VzIGZyb20gz4YwLlxyXG4gICAgICAgICAgICBmb3IgKGxldCBqID0gdGhpcy5uaiAtIDE7IGogPj0gMDsgai0tKSB7XHJcbiAgICAgICAgICAgICAgICBsZXQgcm93ID0gW107XHJcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubmk7IGkrKyAsIHArKykge1xyXG4gICAgICAgICAgICAgICAgICAgIHJvd1tpXSA9IHRoaXMuYnVpbGRlci5kYXRhKHApO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYgKGlzQ29udGludW91cykge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIEZvciB3cmFwcGVkIGdyaWRzLCBkdXBsaWNhdGUgZmlyc3QgY29sdW1uIGFzIGxhc3QgY29sdW1uIHRvIHNpbXBsaWZ5IGludGVycG9sYXRpb24gbG9naWNcclxuICAgICAgICAgICAgICAgICAgICByb3cucHVzaChyb3dbMF0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgdGhpcy5ncmlkW2pdID0gcm93O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjYWxsYmFjayh7XHJcbiAgICAgICAgICAgIGRhdGU6IHRoaXMuZGF0ZSxcclxuICAgICAgICAgICAgaW50ZXJwb2xhdGU6IHRoaXMuaW50ZXJwb2xhdGVcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGNyZWF0ZUJ1aWxkZXIoZGF0YSkge1xyXG4gICAgICAgIGxldCB1Q29tcCA9IG51bGwsXHJcbiAgICAgICAgICAgIHZDb21wID0gbnVsbCxcclxuICAgICAgICAgICAgc2NhbGFyID0gbnVsbCxcclxuICAgICAgICAgICAgZGlyZWN0aW9uVHJ1ZSA9IG51bGwsXHJcbiAgICAgICAgICAgIG1hZ25pdHVkZSA9IG51bGw7XHJcblxyXG4gICAgICAgIGxldCBzdXBwb3J0ZWQgPSB0cnVlO1xyXG4gICAgICAgIGxldCBoZWFkZXJGaWVsZHM7XHJcblxyXG4gICAgICAgIGRhdGEuZm9yRWFjaCgocmVjb3JkKSA9PiB7XHJcbiAgICAgICAgICAgIGhlYWRlckZpZWxkcyA9IGAke3JlY29yZC5oZWFkZXIuZGlzY2lwbGluZX0sJHtyZWNvcmQuaGVhZGVyLnBhcmFtZXRlckNhdGVnb3J5fSwke3JlY29yZC5oZWFkZXIucGFyYW1ldGVyTnVtYmVyfWA7XHJcbiAgICAgICAgICAgIHN3aXRjaCAoaGVhZGVyRmllbGRzKSB7XHJcbiAgICAgICAgICAgICAgICBjYXNlIFwiMCwxLDJcIjpcclxuICAgICAgICAgICAgICAgIGNhc2UgXCIwLDIsMlwiOlxyXG4gICAgICAgICAgICAgICAgICAgIHVDb21wID0gcmVjb3JkOyAvLyB0aGlzIGlzIG1ldGVvcm9sb2dpY2FsIGNvbXBvbmVudCB3aXRoIHUgYW5kIHYuXHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICBjYXNlIFwiMCwxLDNcIjpcclxuICAgICAgICAgICAgICAgIGNhc2UgXCIwLDIsM1wiOlxyXG4gICAgICAgICAgICAgICAgICAgIHZDb21wID0gcmVjb3JkOyAvLyB0aGlzIGlzIG1ldGVvcm9sb2dpY2FsIGNvbXBvbmVudCB3aXRoIHUgYW5kIHYuXHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICBjYXNlIFwiMTAsMCw3XCI6XHJcbiAgICAgICAgICAgICAgICBjYXNlIFwiMTAsMCwxMFwiOlxyXG4gICAgICAgICAgICAgICAgY2FzZSBcIjAsMiwwXCI6XHJcbiAgICAgICAgICAgICAgICAgICAgZGlyZWN0aW9uVHJ1ZSA9IHJlY29yZDsgLy93YXZlcyBhbmQgd2luZCBkaXJlY3Rpb25cclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIGNhc2UgXCIxMCwwLDhcIjpcclxuICAgICAgICAgICAgICAgIGNhc2UgXCIxMCwwLDNcIjpcclxuICAgICAgICAgICAgICAgIGNhc2UgXCIwLDIsMVwiOlxyXG4gICAgICAgICAgICAgICAgICAgIG1hZ25pdHVkZSA9IHJlY29yZDsgLy93YXZlcyBhbmQgd2luZCBoZWlnaHRcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICAgICAgc3VwcG9ydGVkID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyBqdXN0IHRha2UgdGhlIGxhc3QgcmVjb3JkcyByZWZ0aW1lIGFuZCBmb3JlY2FzdCB0aW1lIGFzIHRoZSBvbmUgd2UncmUgdXNpbmdcclxuICAgICAgICAgICAgdGhpcy5yZWZUaW1lID0gcmVjb3JkLmhlYWRlci5yZWZUaW1lO1xyXG4gICAgICAgICAgICB0aGlzLmZvcmVjYXN0VGltZSA9IHJlY29yZC5oZWFkZXIuZm9yZWNhc3RUaW1lO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBpZiAoIXN1cHBvcnRlZCkge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiV2luZHkgZG9lc24ndCBzdXBwb3J0IGRpc2NpcGxpbmUsIGNhdGVnb3J5IGFuZCBudW1iZXIgY29tYmluYXRpb24uIFwiICsgaGVhZGVyRmllbGRzKTtcclxuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgICAgICB9XHJcblxyXG5cclxuICAgICAgICBpZiAoZGlyZWN0aW9uVHJ1ZSAmJiBtYWduaXR1ZGUpIHtcclxuICAgICAgICAgICAgLy8gSWYgZGF0YSBjb250YWlucyBhIGRpcmVjdGlvbiBhbmQgbWFnbml0dWRlIGNvbnZlcnQgaXQgdG8gYSB1IGFuZCB2LlxyXG4gICAgICAgICAgICB1Q29tcCA9IHt9O1xyXG4gICAgICAgICAgICB1Q29tcC5oZWFkZXIgPSBkaXJlY3Rpb25UcnVlLmhlYWRlcjtcclxuICAgICAgICAgICAgdkNvbXAgPSB7fTtcclxuICAgICAgICAgICAgdkNvbXAuaGVhZGVyID0gZGlyZWN0aW9uVHJ1ZS5oZWFkZXI7XHJcbiAgICAgICAgICAgIHVDb21wLmRhdGEgPSBbXTtcclxuICAgICAgICAgICAgdkNvbXAuZGF0YSA9IFtdO1xyXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gZGlyZWN0aW9uVHJ1ZS5kYXRhLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcblxyXG4gICAgICAgICAgICAgICAgbGV0IGRpciA9IGRpcmVjdGlvblRydWUuZGF0YVtpXTtcclxuICAgICAgICAgICAgICAgIGxldCBtYWcgPSBtYWduaXR1ZGUuZGF0YVtpXTtcclxuXHJcbiAgICAgICAgICAgICAgICBpZiAoKCFkaXIgfHwgaXNOYU4oZGlyKSkgfHwgKCFtYWcgfHwgaXNOYU4obWFnKSkpIHtcclxuICAgICAgICAgICAgICAgICAgICB2Q29tcFtpXSA9IG51bGw7XHJcbiAgICAgICAgICAgICAgICAgICAgdUNvbXBbaV0gPSBudWxsO1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIGxldCBwaGkgPSBkaXIgKiBNYXRoLlBJIC8gMTgwO1xyXG4gICAgICAgICAgICAgICAgbGV0IHUgPSAtbWFnICogTWF0aC5zaW4ocGhpKTtcclxuICAgICAgICAgICAgICAgIGxldCB2ID0gLW1hZyAqIE1hdGguY29zKHBoaSk7XHJcblxyXG4gICAgICAgICAgICAgICAgdUNvbXAuZGF0YVtpXSA9IHU7XHJcbiAgICAgICAgICAgICAgICB2Q29tcC5kYXRhW2ldID0gdjtcclxuXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG5cclxuICAgICAgICByZXR1cm4gdGhpcy5jcmVhdGVXaW5kQnVpbGRlcih1Q29tcCwgdkNvbXApO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgY3JlYXRlV2luZEJ1aWxkZXIodUNvbXAsIHZDb21wKSB7XHJcbiAgICAgICAgbGV0IHVEYXRhID0gdUNvbXAuZGF0YSxcclxuICAgICAgICAgICAgdkRhdGEgPSB2Q29tcC5kYXRhO1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIGhlYWRlcjogdUNvbXAuaGVhZGVyLFxyXG4gICAgICAgICAgICBkYXRhOiBmdW5jdGlvbiBkYXRhKGkpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBbdURhdGFbaV0sIHZEYXRhW2ldXTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgaW50ZXJwb2xhdGU6IHRoaXMuYmlsaW5lYXJJbnRlcnBvbGF0ZVZlY3RvclxyXG4gICAgICAgIH07XHJcbiAgICB9XHJcblxyXG5cclxuICAgIHByaXZhdGUgYnVpbGRCb3VuZHMoYm91bmRzLCB3aWR0aCwgaGVpZ2h0KSB7XHJcbiAgICAgICAgbGV0IHVwcGVyTGVmdCA9IGJvdW5kc1swXTtcclxuICAgICAgICBsZXQgbG93ZXJSaWdodCA9IGJvdW5kc1sxXTtcclxuICAgICAgICBsZXQgeCA9IE1hdGgucm91bmQodXBwZXJMZWZ0WzBdKTtcclxuICAgICAgICBsZXQgeSA9IE1hdGgubWF4KE1hdGguZmxvb3IodXBwZXJMZWZ0WzFdKSwgMCk7XHJcbiAgICAgICAgbGV0IHhNYXggPSBNYXRoLm1pbihNYXRoLmNlaWwobG93ZXJSaWdodFswXSksIHdpZHRoIC0gMSk7XHJcbiAgICAgICAgbGV0IHlNYXggPSBNYXRoLm1pbihNYXRoLmNlaWwobG93ZXJSaWdodFsxXSksIGhlaWdodCAtIDEpO1xyXG4gICAgICAgIHJldHVybiB7IHg6IHgsIHk6IHksIHhNYXg6IHdpZHRoLCB5TWF4OiB5TWF4LCB3aWR0aDogd2lkdGgsIGhlaWdodDogaGVpZ2h0IH07XHJcbiAgICB9XHJcblxyXG5cclxuICAgIC8vIGludGVycG9sYXRpb24gZm9yIHZlY3RvcnMgbGlrZSB3aW5kICh1LHYsbSlcclxuICAgIHByaXZhdGUgYmlsaW5lYXJJbnRlcnBvbGF0ZVZlY3Rvcih4LCB5LCBnMDAsIGcxMCwgZzAxLCBnMTEpIHtcclxuICAgICAgICBsZXQgcnggPSAxIC0geDtcclxuICAgICAgICBsZXQgcnkgPSAxIC0geTtcclxuICAgICAgICBsZXQgYSA9IHJ4ICogcnksXHJcbiAgICAgICAgICAgIGIgPSB4ICogcnksXHJcbiAgICAgICAgICAgIGMgPSByeCAqIHksXHJcbiAgICAgICAgICAgIGQgPSB4ICogeTtcclxuICAgICAgICBsZXQgdSA9IGcwMFswXSAqIGEgKyBnMTBbMF0gKiBiICsgZzAxWzBdICogYyArIGcxMVswXSAqIGQ7XHJcbiAgICAgICAgbGV0IHYgPSBnMDBbMV0gKiBhICsgZzEwWzFdICogYiArIGcwMVsxXSAqIGMgKyBnMTFbMV0gKiBkO1xyXG4gICAgICAgIHJldHVybiBbdSwgdiwgTWF0aC5zcXJ0KHUgKiB1ICsgdiAqIHYpXTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGRlZzJyYWQoZGVnKSB7XHJcbiAgICAgICAgcmV0dXJuIGRlZyAvIDE4MCAqIE1hdGguUEk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSByYWQyZGVnKGFuZykge1xyXG4gICAgICAgIHJldHVybiBhbmcgLyAoTWF0aC5QSSAvIDE4MC4wKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICogQHJldHVybnMge0Jvb2xlYW59IHRydWUgaWYgdGhlIHNwZWNpZmllZCB2YWx1ZSBpcyBub3QgbnVsbCBhbmQgbm90IHVuZGVmaW5lZC5cclxuICAgICovXHJcbiAgICBwcml2YXRlIGlzVmFsdWUoeCkge1xyXG4gICAgICAgIHJldHVybiB4ICE9PSBudWxsICYmIHggIT09IHVuZGVmaW5lZDtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICogQHJldHVybnMge051bWJlcn0gcmV0dXJucyByZW1haW5kZXIgb2YgZmxvb3JlZCBkaXZpc2lvbiwgaS5lLiwgZmxvb3IoYSAvIG4pLiBVc2VmdWwgZm9yIGNvbnNpc3RlbnQgbW9kdWxvXHJcbiAgICAqICAgICAgICAgIG9mIG5lZ2F0aXZlIG51bWJlcnMuIFNlZSBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL01vZHVsb19vcGVyYXRpb24uXHJcbiAgICAqL1xyXG4gICAgcHJpdmF0ZSBmbG9vck1vZChhLCBuKSB7XHJcbiAgICAgICAgcmV0dXJuIGEgLSBuICogTWF0aC5mbG9vcihhIC8gbik7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAqIEByZXR1cm5zIHtOdW1iZXJ9IHRoZSB2YWx1ZSB4IGNsYW1wZWQgdG8gdGhlIHJhbmdlIFtsb3csIGhpZ2hdLlxyXG4gICAgKi9cclxuICAgIHByaXZhdGUgY2xhbXAoeCwgcmFuZ2UpIHtcclxuICAgICAgICByZXR1cm4gTWF0aC5tYXgocmFuZ2VbMF0sIE1hdGgubWluKHgsIHJhbmdlWzFdKSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAqIEByZXR1cm5zIHtCb29sZWFufSB0cnVlIGlmIGFnZW50IGlzIHByb2JhYmx5IGEgbW9iaWxlIGRldmljZS4gRG9uJ3QgcmVhbGx5IGNhcmUgaWYgdGhpcyBpcyBhY2N1cmF0ZS5cclxuICAgICovXHJcbiAgICBwcml2YXRlIGlzTW9iaWxlKCkge1xyXG4gICAgICAgIHJldHVybiAoL2FuZHJvaWR8YmxhY2tiZXJyeXxpZW1vYmlsZXxpcGFkfGlwaG9uZXxpcG9kfG9wZXJhIG1pbml8d2Vib3MvaS50ZXN0KG5hdmlnYXRvci51c2VyQWdlbnQpKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICogQ2FsY3VsYXRlIGRpc3RvcnRpb24gb2YgdGhlIHdpbmQgdmVjdG9yIGNhdXNlZCBieSB0aGUgc2hhcGUgb2YgdGhlIHByb2plY3Rpb24gYXQgcG9pbnQgKHgsIHkpLiBUaGUgd2luZFxyXG4gICAgKiB2ZWN0b3IgaXMgbW9kaWZpZWQgaW4gcGxhY2UgYW5kIHJldHVybmVkIGJ5IHRoaXMgZnVuY3Rpb24uXHJcbiAgICAqL1xyXG4gICAgcHJpdmF0ZSBkaXN0b3J0KHByb2plY3Rpb24sIM67LCDPhiwgeCwgeSwgc2NhbGUsIHdpbmQsIHdpbmR5KSB7XHJcbiAgICAgICAgdmFyIHUgPSB3aW5kWzBdICogc2NhbGU7XHJcbiAgICAgICAgdmFyIHYgPSB3aW5kWzFdICogc2NhbGU7XHJcbiAgICAgICAgdmFyIGQgPSB0aGlzLmRpc3RvcnRpb24ocHJvamVjdGlvbiwgzrssIM+GLCB4LCB5LCB3aW5keSk7XHJcblxyXG4gICAgICAgIC8vIFNjYWxlIGRpc3RvcnRpb24gdmVjdG9ycyBieSB1IGFuZCB2LCB0aGVuIGFkZC5cclxuICAgICAgICB3aW5kWzBdID0gZFswXSAqIHUgKyBkWzJdICogdjtcclxuICAgICAgICB3aW5kWzFdID0gZFsxXSAqIHUgKyBkWzNdICogdjtcclxuICAgICAgICByZXR1cm4gd2luZDtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGRpc3RvcnRpb24ocHJvamVjdGlvbiwgzrssIM+GLCB4LCB5LCB3aW5keSkge1xyXG4gICAgICAgIGxldCDPhCA9IDIgKiBNYXRoLlBJO1xyXG4gICAgICAgIGxldCBIID0gTWF0aC5wb3coMTAsIC01LjIpO1xyXG4gICAgICAgIGxldCBozrsgPSDOuyA8IDAgPyBIIDogLUg7XHJcbiAgICAgICAgbGV0IGjPhiA9IM+GIDwgMCA/IEggOiAtSDtcclxuXHJcbiAgICAgICAgbGV0IHDOuyA9IHRoaXMucHJvamVjdCjPhiwgzrsgKyBozrssIHdpbmR5KTtcclxuICAgICAgICBsZXQgcM+GID0gdGhpcy5wcm9qZWN0KM+GICsgaM+GLCDOuywgd2luZHkpO1xyXG5cclxuICAgICAgICAvLyBNZXJpZGlhbiBzY2FsZSBmYWN0b3IgKHNlZSBTbnlkZXIsIGVxdWF0aW9uIDQtMyksIHdoZXJlIFIgPSAxLiBUaGlzIGhhbmRsZXMgaXNzdWUgd2hlcmUgbGVuZ3RoIG9mIDHCuiDOu1xyXG4gICAgICAgIC8vIGNoYW5nZXMgZGVwZW5kaW5nIG9uIM+GLiBXaXRob3V0IHRoaXMsIHRoZXJlIGlzIGEgcGluY2hpbmcgZWZmZWN0IGF0IHRoZSBwb2xlcy5cclxuICAgICAgICBsZXQgayA9IE1hdGguY29zKM+GIC8gMzYwICogz4QpO1xyXG4gICAgICAgIHJldHVybiBbKHDOu1swXSAtIHgpIC8gaM67IC8gaywgKHDOu1sxXSAtIHkpIC8gaM67IC8gaywgKHDPhlswXSAtIHgpIC8gaM+GLCAocM+GWzFdIC0geSkgLyBoz4ZdO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgbWVyY1kobGF0KSB7XHJcbiAgICAgICAgcmV0dXJuIE1hdGgubG9nKE1hdGgudGFuKGxhdCAvIDIgKyBNYXRoLlBJIC8gNCkpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgcHJvamVjdChsYXQsIGxvbiwgd2luZHkpIHtcclxuICAgICAgICAvLyBib3RoIGluIHJhZGlhbnMsIHVzZSBkZWcycmFkIGlmIG5lY2Nlc3NhcnlcclxuICAgICAgICBsZXQgeW1pbiA9IHRoaXMubWVyY1kod2luZHkuc291dGgpO1xyXG4gICAgICAgIGxldCB5bWF4ID0gdGhpcy5tZXJjWSh3aW5keS5ub3J0aCk7XHJcbiAgICAgICAgbGV0IHhGYWN0b3IgPSB3aW5keS53aWR0aCAvICh3aW5keS5lYXN0IC0gd2luZHkud2VzdCk7XHJcbiAgICAgICAgbGV0IHlGYWN0b3IgPSB3aW5keS5oZWlnaHQgLyAoeW1heCAtIHltaW4pO1xyXG5cclxuICAgICAgICBsZXQgeSA9IHRoaXMubWVyY1kodGhpcy5kZWcycmFkKGxhdCkpO1xyXG4gICAgICAgIGxldCB4ID0gKHRoaXMuZGVnMnJhZChsb24pIC0gd2luZHkud2VzdCkgKiB4RmFjdG9yO1xyXG4gICAgICAgIHkgPSAoeW1heCAtIHkpICogeUZhY3RvcjsgLy8geSBwb2ludHMgc291dGhcclxuICAgICAgICByZXR1cm4gW3gsIHldO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgaW52ZXJ0KHgsIHksIHdpbmR5KSB7XHJcbiAgICAgICAgbGV0IG1hcExvbkRlbHRhID0gd2luZHkuZWFzdCAtIHdpbmR5Lndlc3Q7XHJcbiAgICAgICAgbGV0IHdvcmxkTWFwUmFkaXVzID0gd2luZHkud2lkdGggLyB0aGlzLnJhZDJkZWcobWFwTG9uRGVsdGEpICogMzYwIC8gKDIgKiBNYXRoLlBJKTtcclxuICAgICAgICBsZXQgbWFwT2Zmc2V0WSA9IHdvcmxkTWFwUmFkaXVzIC8gMiAqIE1hdGgubG9nKCgxICsgTWF0aC5zaW4od2luZHkuc291dGgpKSAvICgxIC0gTWF0aC5zaW4od2luZHkuc291dGgpKSk7XHJcbiAgICAgICAgbGV0IGVxdWF0b3JZID0gd2luZHkuaGVpZ2h0ICsgbWFwT2Zmc2V0WTtcclxuICAgICAgICBsZXQgYSA9IChlcXVhdG9yWSAtIHkpIC8gd29ybGRNYXBSYWRpdXM7XHJcblxyXG4gICAgICAgIGxldCBsYXQgPSAxODAgLyBNYXRoLlBJICogKDIgKiBNYXRoLmF0YW4oTWF0aC5leHAoYSkpIC0gTWF0aC5QSSAvIDIpO1xyXG4gICAgICAgIGxldCBsb24gPSB0aGlzLnJhZDJkZWcod2luZHkud2VzdCkgKyB4IC8gd2luZHkud2lkdGggKiB0aGlzLnJhZDJkZWcobWFwTG9uRGVsdGEpO1xyXG4gICAgICAgIHJldHVybiBbbG9uLCBsYXRdO1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICBwcml2YXRlIGludGVycG9sYXRlRmllbGQoZ3JpZCwgYm91bmRzLCBleHRlbnQsIGNhbGxiYWNrKSB7XHJcblxyXG4gICAgICAgIGxldCBwcm9qZWN0aW9uID0ge307XHJcbiAgICAgICAgbGV0IG1hcEFyZWEgPSAoZXh0ZW50LnNvdXRoIC0gZXh0ZW50Lm5vcnRoKSAqIChleHRlbnQud2VzdCAtIGV4dGVudC5lYXN0KTtcclxuICAgICAgICBsZXQgdmVsb2NpdHlTY2FsZSA9IHRoaXMuVkVMT0NJVFlfU0NBTEUgKiBNYXRoLnBvdyhtYXBBcmVhLCAwLjQpO1xyXG5cclxuICAgICAgICBsZXQgY29sdW1ucyA9IFtdO1xyXG4gICAgICAgIGxldCB4ID0gYm91bmRzLng7XHJcblxyXG4gICAgICAgIGxldCBpbnRlcnBvbGF0ZUNvbHVtbiA9ICh4KSA9PiB7XHJcbiAgICAgICAgICAgIGxldCBjb2x1bW4gPSBbXTtcclxuICAgICAgICAgICAgZm9yIChsZXQgeSA9IGJvdW5kcy55OyB5IDw9IGJvdW5kcy55TWF4OyB5ICs9IDIpIHtcclxuICAgICAgICAgICAgICAgIGxldCBjb29yZCA9IHRoaXMuaW52ZXJ0KHgsIHksIGV4dGVudCk7XHJcbiAgICAgICAgICAgICAgICBpZiAoY29vcmQpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgzrsgPSBjb29yZFswXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgz4YgPSBjb29yZFsxXTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoaXNGaW5pdGUozrspKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vbGV0IHdpbmQgPSBncmlkLmludGVycG9sYXRlKM67LCDPhik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCB3aW5kID0gdGhpcy5pbnRlcnBvbGF0ZSjOuywgz4YpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAod2luZCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgd2luZCA9IHRoaXMuZGlzdG9ydChwcm9qZWN0aW9uLCDOuywgz4YsIHgsIHksIHZlbG9jaXR5U2NhbGUsIHdpbmQsIGV4dGVudCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2x1bW5beSArIDFdID0gY29sdW1uW3ldID0gd2luZDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBjb2x1bW5zW3ggKyAxXSA9IGNvbHVtbnNbeF0gPSBjb2x1bW47XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgbGV0IGJhdGNoSW50ZXJwb2xhdGUgPSAoKSA9PiB7XHJcbiAgICAgICAgICAgIGxldCBzdGFydCA9IERhdGUubm93KCk7XHJcbiAgICAgICAgICAgIHdoaWxlICh4IDwgYm91bmRzLndpZHRoKSB7XHJcbiAgICAgICAgICAgICAgICBpbnRlcnBvbGF0ZUNvbHVtbih4KTtcclxuICAgICAgICAgICAgICAgIHggKz0gMjtcclxuICAgICAgICAgICAgICAgIGlmIChEYXRlLm5vdygpIC0gc3RhcnQgPiAxMDAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy9NQVhfVEFTS19USU1FKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiBiYXRjaEludGVycG9sYXRlLCAyNSk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHRoaXMuY3JlYXRlRmllbGQoY29sdW1ucywgYm91bmRzLCBjYWxsYmFjayk7XHJcbiAgICAgICAgfTtcclxuICAgICAgICBiYXRjaEludGVycG9sYXRlKCk7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIHByaXZhdGUgY3JlYXRlRmllbGQoY29sdW1ucywgYm91bmRzLCBjYWxsYmFjaykge1xyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAqIEByZXR1cm5zIHtBcnJheX0gd2luZCB2ZWN0b3IgW3UsIHYsIG1hZ25pdHVkZV0gYXQgdGhlIHBvaW50ICh4LCB5KSwgb3IgW05hTiwgTmFOLCBudWxsXSBpZiB3aW5kXHJcbiAgICAgICAgKiAgICAgICAgICBpcyB1bmRlZmluZWQgYXQgdGhhdCBwb2ludC5cclxuICAgICAgICAqL1xyXG4gICAgICAgIGxldCBmaWVsZDogYW55ID0gKHgsIHkpID0+IHtcclxuICAgICAgICAgICAgdmFyIGNvbHVtbiA9IGNvbHVtbnNbTWF0aC5yb3VuZCh4KV07XHJcbiAgICAgICAgICAgIHJldHVybiBjb2x1bW4gJiYgY29sdW1uW01hdGgucm91bmQoeSldIHx8IHRoaXMuTlVMTF9XSU5EX1ZFQ1RPUjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIEZyZWVzIHRoZSBtYXNzaXZlIFwiY29sdW1uc1wiIGFycmF5IGZvciBHQy4gV2l0aG91dCB0aGlzLCB0aGUgYXJyYXkgaXMgbGVha2VkIChpbiBDaHJvbWUpIGVhY2ggdGltZSBhIG5ld1xyXG4gICAgICAgIC8vIGZpZWxkIGlzIGludGVycG9sYXRlZCBiZWNhdXNlIHRoZSBmaWVsZCBjbG9zdXJlJ3MgY29udGV4dCBpcyBsZWFrZWQsIGZvciByZWFzb25zIHRoYXQgZGVmeSBleHBsYW5hdGlvbi5cclxuICAgICAgICBmaWVsZC5yZWxlYXNlID0gKCkgPT4ge1xyXG4gICAgICAgICAgICBjb2x1bW5zID0gW107XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgZmllbGQucmFuZG9taXplID0gKG8pID0+IHtcclxuICAgICAgICAgICAgLy8gVU5ET05FOiB0aGlzIG1ldGhvZCBpcyB0ZXJyaWJsZVxyXG4gICAgICAgICAgICB2YXIgeCwgeTtcclxuICAgICAgICAgICAgdmFyIHNhZmV0eU5ldCA9IDA7XHJcbiAgICAgICAgICAgIGRvIHtcclxuICAgICAgICAgICAgICAgIHggPSBNYXRoLnJvdW5kKE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIGJvdW5kcy53aWR0aCkgKyBib3VuZHMueCk7XHJcbiAgICAgICAgICAgICAgICB5ID0gTWF0aC5yb3VuZChNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBib3VuZHMuaGVpZ2h0KSArIGJvdW5kcy55KTtcclxuICAgICAgICAgICAgfSB3aGlsZSAoZmllbGQoeCwgeSlbMl0gPT09IG51bGwgJiYgc2FmZXR5TmV0KysgPCAzMCk7XHJcbiAgICAgICAgICAgIG8ueCA9IHg7XHJcbiAgICAgICAgICAgIG8ueSA9IHk7XHJcbiAgICAgICAgICAgIHJldHVybiBvO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGNhbGxiYWNrKGJvdW5kcywgZmllbGQpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYW5pbWF0ZShib3VuZHMsIGZpZWxkKSB7XHJcblxyXG4gICAgICAgIGxldCB3aW5kSW50ZW5zaXR5Q29sb3JTY2FsZSA9IChtaW4sIG1heCkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLmNvbG9yU2NhbGUuaW5kZXhGb3IgPSAobSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgLy8gbWFwIHZlbG9jaXR5IHNwZWVkIHRvIGEgc3R5bGVcclxuICAgICAgICAgICAgICAgIHJldHVybiBNYXRoLm1heCgwLCBNYXRoLm1pbih0aGlzLmNvbG9yU2NhbGUubGVuZ3RoIC0gMSwgTWF0aC5yb3VuZCgobSAtIG1pbikgLyAobWF4IC0gbWluKSAqICh0aGlzLmNvbG9yU2NhbGUubGVuZ3RoIC0gMSkpKSk7XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNvbG9yU2NhbGU7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgY29sb3JTdHlsZXMgPSB3aW5kSW50ZW5zaXR5Q29sb3JTY2FsZSh0aGlzLk1JTl9WRUxPQ0lUWV9JTlRFTlNJVFksIHRoaXMuTUFYX1ZFTE9DSVRZX0lOVEVOU0lUWSk7XHJcbiAgICAgICAgbGV0IGJ1Y2tldHMgPSBjb2xvclN0eWxlcy5tYXAoZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gW107XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGxldCBwYXJ0aWNsZUNvdW50ID0gTWF0aC5yb3VuZChib3VuZHMud2lkdGggKiBib3VuZHMuaGVpZ2h0ICogdGhpcy5QQVJUSUNMRV9NVUxUSVBMSUVSIC8gMTAwMCk7XHJcbiAgICAgICAgaWYgKHRoaXMuaXNNb2JpbGUoKSkge1xyXG4gICAgICAgICAgICBwYXJ0aWNsZUNvdW50ICo9IHRoaXMuUEFSVElDTEVfUkVEVUNUSU9OO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IGZhZGVGaWxsU3R5bGUgPSBcInJnYmEoMCwgMCwgMCwgMC45NylcIjtcclxuXHJcbiAgICAgICAgbGV0IHBhcnRpY2xlcyA9IFtdO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcGFydGljbGVDb3VudDsgaSsrKSB7XHJcbiAgICAgICAgICAgIHBhcnRpY2xlcy5wdXNoKGZpZWxkLnJhbmRvbWl6ZSh7IGFnZTogTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogdGhpcy5NQVhfUEFSVElDTEVfQUdFKSArIDAgfSkpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IGV2b2x2ZSA9ICgpID0+IHtcclxuICAgICAgICAgICAgYnVja2V0cy5mb3JFYWNoKChidWNrZXQpID0+IHtcclxuICAgICAgICAgICAgICAgIGJ1Y2tldC5sZW5ndGggPSAwO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgcGFydGljbGVzLmZvckVhY2goKHBhcnRpY2xlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZiAocGFydGljbGUuYWdlID4gdGhpcy5NQVhfUEFSVElDTEVfQUdFKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZmllbGQucmFuZG9taXplKHBhcnRpY2xlKS5hZ2UgPSAwO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgdmFyIHggPSBwYXJ0aWNsZS54O1xyXG4gICAgICAgICAgICAgICAgdmFyIHkgPSBwYXJ0aWNsZS55O1xyXG4gICAgICAgICAgICAgICAgdmFyIHYgPSBmaWVsZCh4LCB5KTsgLy8gdmVjdG9yIGF0IGN1cnJlbnQgcG9zaXRpb25cclxuICAgICAgICAgICAgICAgIHZhciBtID0gdlsyXTtcclxuICAgICAgICAgICAgICAgIGlmIChtID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcGFydGljbGUuYWdlID0gdGhpcy5NQVhfUEFSVElDTEVfQUdFOyAvLyBwYXJ0aWNsZSBoYXMgZXNjYXBlZCB0aGUgZ3JpZCwgbmV2ZXIgdG8gcmV0dXJuLi4uXHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciB4dCA9IHggKyB2WzBdO1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciB5dCA9IHkgKyB2WzFdO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChmaWVsZCh4dCwgeXQpWzJdICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFBhdGggZnJvbSAoeCx5KSB0byAoeHQseXQpIGlzIHZpc2libGUsIHNvIGFkZCB0aGlzIHBhcnRpY2xlIHRvIHRoZSBhcHByb3ByaWF0ZSBkcmF3IGJ1Y2tldC5cclxuICAgICAgICAgICAgICAgICAgICAgICAgcGFydGljbGUueHQgPSB4dDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcGFydGljbGUueXQgPSB5dDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYnVja2V0c1tjb2xvclN0eWxlcy5pbmRleEZvcihtKV0ucHVzaChwYXJ0aWNsZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gUGFydGljbGUgaXNuJ3QgdmlzaWJsZSwgYnV0IGl0IHN0aWxsIG1vdmVzIHRocm91Z2ggdGhlIGZpZWxkLlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJ0aWNsZS54ID0geHQ7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcnRpY2xlLnkgPSB5dDtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBwYXJ0aWNsZS5hZ2UgKz0gMTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgZyA9IHRoaXMuY2FudmFzLmdldENvbnRleHQoXCIyZFwiKTtcclxuICAgICAgICBnLmxpbmVXaWR0aCA9IHRoaXMuUEFSVElDTEVfTElORV9XSURUSDtcclxuICAgICAgICBnLmZpbGxTdHlsZSA9IGZhZGVGaWxsU3R5bGU7XHJcbiAgICAgICAgZy5nbG9iYWxBbHBoYSA9IDAuNjtcclxuXHJcbiAgICAgICAgbGV0IGRyYXcgPSAoKSA9PiB7XHJcbiAgICAgICAgICAgIC8vIEZhZGUgZXhpc3RpbmcgcGFydGljbGUgdHJhaWxzLlxyXG4gICAgICAgICAgICBsZXQgcHJldiA9IFwibGlnaHRlclwiO1xyXG4gICAgICAgICAgICBnLmdsb2JhbENvbXBvc2l0ZU9wZXJhdGlvbiA9IFwiZGVzdGluYXRpb24taW5cIjtcclxuICAgICAgICAgICAgZy5maWxsUmVjdChib3VuZHMueCwgYm91bmRzLnksIGJvdW5kcy53aWR0aCwgYm91bmRzLmhlaWdodCk7XHJcbiAgICAgICAgICAgIGcuZ2xvYmFsQ29tcG9zaXRlT3BlcmF0aW9uID0gcHJldjtcclxuICAgICAgICAgICAgZy5nbG9iYWxBbHBoYSA9IDAuOTtcclxuXHJcbiAgICAgICAgICAgIC8vIERyYXcgbmV3IHBhcnRpY2xlIHRyYWlscy5cclxuICAgICAgICAgICAgYnVja2V0cy5mb3JFYWNoKChidWNrZXQsIGkpID0+IHtcclxuICAgICAgICAgICAgICAgIGlmIChidWNrZXQubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGcuYmVnaW5QYXRoKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgZy5zdHJva2VTdHlsZSA9IGNvbG9yU3R5bGVzW2ldO1xyXG4gICAgICAgICAgICAgICAgICAgIGJ1Y2tldC5mb3JFYWNoKChwYXJ0aWNsZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBnLm1vdmVUbyhwYXJ0aWNsZS54LCBwYXJ0aWNsZS55KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZy5saW5lVG8ocGFydGljbGUueHQsIHBhcnRpY2xlLnl0KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcGFydGljbGUueCA9IHBhcnRpY2xlLnh0O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJ0aWNsZS55ID0gcGFydGljbGUueXQ7XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgZy5zdHJva2UoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgdGhlbiA9IERhdGUubm93KCk7XHJcbiAgICAgICAgbGV0IGZyYW1lID0gKCkgPT4ge1xyXG4gICAgICAgICAgICBXaW5keS5hbmltYXRpb25Mb29wID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKGZyYW1lKTtcclxuICAgICAgICAgICAgdmFyIG5vdyA9IERhdGUubm93KCk7XHJcbiAgICAgICAgICAgIHZhciBkZWx0YSA9IG5vdyAtIHRoZW47XHJcbiAgICAgICAgICAgIGlmIChkZWx0YSA+IHRoaXMuRlJBTUVfVElNRSkge1xyXG4gICAgICAgICAgICAgICAgdGhlbiA9IG5vdyAtIGRlbHRhICUgdGhpcy5GUkFNRV9USU1FO1xyXG4gICAgICAgICAgICAgICAgZXZvbHZlKCk7XHJcbiAgICAgICAgICAgICAgICBkcmF3KCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9O1xyXG4gICAgICAgIGZyYW1lKCk7XHJcbiAgICB9XHJcbn1cclxuXHJcbmlmICghd2luZG93LmNhbmNlbEFuaW1hdGlvbkZyYW1lKSB7XHJcbiAgICB3aW5kb3cuY2FuY2VsQW5pbWF0aW9uRnJhbWUgPSAoaWQpID0+IHtcclxuICAgICAgICBjbGVhclRpbWVvdXQoaWQpO1xyXG4gICAgfTtcclxufSJdfQ==
