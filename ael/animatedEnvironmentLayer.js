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
            // If the active view is set in properties, then set it here.
            _this._activeView = properties.activeView;
            _this.url = properties.url;
            _this.displayOptions = properties.displayOptions;
            _this.reportValues = properties.reportValues === false ? false : true; // default to true
            _this.on("layerview-create", function (evt) { return _this._layerViewCreated(evt); });
            // watch url prop so a fetch of data and redraw will occur.
            watchUtils.watch(_this, "url", function (a, b, c, d) { return _this._urlChanged(a, b, c, d); });
            // watch display options so to redraw when changed.
            watchUtils.watch(_this, "displayOptions", function (a, b, c, d) { return _this._displayOptionsChanged(a, b, c, d); });
            _this._dataFetchRequired = true;
            return _this;
        }
        /**
         * Start a draw
         */
        AnimatedEnvironmentLayer.prototype.draw = function () {
            var _this = this;
            this._setupDraw(this._activeView.width, this._activeView.height);
            // if data should be fetched, go get it now.
            if (this._dataFetchRequired) {
                esriRequest(this.url, {
                    responseType: "json"
                })
                    .then(function (response) {
                    _this._dataFetchRequired = false;
                    _this._windy.setData(response.data);
                    _this._doDraw(); // all sorted draw now.
                })
                    .otherwise(function (err) {
                    console.error("Error occurred retrieving data. " + err);
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
                this.draw();
            }
        };
        AnimatedEnvironmentLayer.prototype._viewPointerMove = function (evt) {
            if (!this._windy)
                return;
            var mousePos = this._getMousePos(evt);
            var point = this._activeView.toMap({ x: mousePos.x, y: mousePos.y });
            if (point.spatialReference.isWebMercator) {
                point = webMercatorUtils.webMercatorToGeographic(point);
            }
            var grid = this._windy.interpolate(point.x, point.y);
            var result = {
                point: point
            };
            if (!grid || (isNaN(grid[0]) || isNaN(grid[1]) || !grid[2])) {
                // the current point contains no data in the windy grid, so emit an undefined object
                this["emit"]("point-report", result);
                return;
            }
            // get the speed and direction and emit the result
            result.speed = this._vectorToSpeed(grid[0], grid[1]);
            result.direction = this._vectorToDegrees(grid[0], grid[1]);
            this["emit"]("point-report", result);
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
         * Return the windy vector data as a direction. Returns the direction in the flow of the data in wth the degrees in a clockwise direction.
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
         * Watch of displayOptions - call draw again with new options set on windy.
         */
        AnimatedEnvironmentLayer.prototype._displayOptionsChanged = function (newOptions, b, c, d) {
            if (!this._windy)
                return;
            this._windy.stop();
            this._windy.setDisplayOptions(newOptions);
            this.draw();
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
        AnimatedEnvironmentLayer = __decorate([
            asd.subclass("AnimatedEnvironmentLayer"),
            __metadata("design:paramtypes", [Object])
        ], AnimatedEnvironmentLayer);
        return AnimatedEnvironmentLayer;
    }(asd.declared(GraphicsLayer)));
    exports.AnimatedEnvironmentLayer = AnimatedEnvironmentLayer;
    /*  Global class for simulating the movement of particle through a 1km wind grid
     credit: All the credit for this work goes to: https://github.com/cambecc for creating the repo:
     https://github.com/cambecc/earth. The majority of this code is directly take nfrom there, since its awesome.
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
            this.PARTICLE_MULTIPLIER = options.particleMultiplier || 1 / 300; // particle count scalar (completely arbitrary--this values looks nice)
            this.PARTICLE_REDUCTION = Math.pow(window.devicePixelRatio, 1 / 3) || 1.6; // multiply particle count for mobiles by this amount
            this.FRAME_RATE = options.frameRate || 15;
            this.FRAME_TIME = 1000 / this.FRAME_RATE; // desired frames per second
            var defaultColorScale = ["rgb(36,104, 180)", "rgb(60,157, 194)", "rgb(128,205,193 )", "rgb(151,218,168)", "rgb(198,231,181)", "rgb(238,247,217)", "rgb(255,238,159)", "rgb(252,217,125)", "rgb(255,182,100)", "rgb(252,150,75)", "rgb(250,112,52)", "rgb(245,64,32)", "rgb(237,45,28)", "rgb(220,24,32)", "rgb(180,0,35)"];
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
            // Scan mode 0 assumed. Longitude increases from λ0, and latitude decreases from φ0.
            // http://www.nco.ncep.noaa.gov/pmb/docs/grib2/grib2_table3-4.shtml
            this.grid = [];
            var p = 0;
            var isContinuous = Math.floor(this.ni * this.Δλ) >= 360;
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
            callback({
                date: this.date,
                interpolate: this.interpolate
            });
        };
        Windy.prototype.createBuilder = function (data) {
            var uComp = null, vComp = null, scalar = null;
            data.forEach(function (record) {
                switch (record.header.parameterCategory + "," + record.header.parameterNumber) {
                    case "1,2":
                    case "2,2":
                        uComp = record;
                        break;
                    case "1,3":
                    case "2,3":
                        vComp = record;
                        break;
                    default:
                        scalar = record;
                }
            });
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
            var particleCount = Math.round(bounds.width * bounds.height * this.PARTICLE_MULTIPLIER);
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3R5cGVzY3JpcHQvYW5pbWF0ZWRFbnZpcm9ubWVudExheWVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDJFQUEyRTtBQUMzRSx3QkFBd0I7QUFDeEIsRUFBRTtBQUNGLGtDQUFrQztBQUNsQyxFQUFFO0FBQ0Ysc0RBQXNEO0FBQ3RELEVBQUU7QUFDRiwyRUFBMkU7QUFDM0UsOEVBQThFO0FBQzlFLDZFQUE2RTtBQUM3RSw0RUFBNEU7QUFDNUUseUVBQXlFO0FBQ3pFLHVFQUF1RTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7SUEyRHZFO1FBQThDLDRDQUEyQjtRQTBCckUsa0NBQVksVUFBOEM7WUFBMUQsWUFDSSxrQkFBTSxVQUFVLENBQUMsU0FnQnBCO1lBbkJPLG9CQUFjLEdBQVcsQ0FBQyxDQUFDO1lBSy9CLDZEQUE2RDtZQUM3RCxLQUFJLENBQUMsV0FBVyxHQUFHLFVBQVUsQ0FBQyxVQUFVLENBQUM7WUFDekMsS0FBSSxDQUFDLEdBQUcsR0FBRyxVQUFVLENBQUMsR0FBRyxDQUFDO1lBQzFCLEtBQUksQ0FBQyxjQUFjLEdBQUcsVUFBVSxDQUFDLGNBQWMsQ0FBQztZQUNoRCxLQUFJLENBQUMsWUFBWSxHQUFHLFVBQVUsQ0FBQyxZQUFZLEtBQUssS0FBSyxHQUFHLEtBQUssR0FBRyxJQUFJLENBQUMsQ0FBQyxrQkFBa0I7WUFFeEYsS0FBSSxDQUFDLEVBQUUsQ0FBQyxrQkFBa0IsRUFBRSxVQUFDLEdBQUcsSUFBSyxPQUFBLEtBQUksQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsRUFBM0IsQ0FBMkIsQ0FBQyxDQUFDO1lBRWxFLDJEQUEyRDtZQUMzRCxVQUFVLENBQUMsS0FBSyxDQUFDLEtBQUksRUFBRSxLQUFLLEVBQUUsVUFBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUssT0FBQSxLQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUE1QixD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QUMsQ0FBQztJQUNOLENBQUMiLCJmaWxlIjoiYW5pbWF0ZWRFbnZpcm9ubWVudExheWVyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXHJcbi8vIFRoZSBNSVQgTGljZW5zZSAoTUlUKVxyXG4vL1xyXG4vLyBDb3B5cmlnaHQgKGMpIDIwMTcgTmljayBDYW1lcm9uXHJcbi8vXHJcbi8vIGh0dHBzOi8vZ2l0aHViLmNvbS9uaWNrY2FtL0FuaW1hdGVkRW52aXJvbm1lbnRMYXllclxyXG4vL1xyXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYSBcclxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZSBcIlNvZnR3YXJlXCIpLCBcclxuLy8gdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nIHdpdGhvdXQgbGltaXRhdGlvbiBcclxuLy8gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIFxyXG4vLyBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0IHBlcnNvbnMgdG8gd2hvbSB0aGUgXHJcbi8vIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnM6XHJcblxyXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBcclxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXHJcblxyXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTIFxyXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSwgXHJcbi8vIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOIE5PIEVWRU5UIFNIQUxMIFxyXG4vLyBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSwgREFNQUdFUyBPUiBPVEhFUlxyXG4vLyBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBcclxuLy8gT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBcclxuLy8gVEhFIFNPRlRXQVJFLlxyXG4vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cclxuXHJcbmltcG9ydCAqIGFzIE1hcFZpZXcgZnJvbSBcImVzcmkvdmlld3MvTWFwVmlld1wiO1xyXG5pbXBvcnQgKiBhcyBTY2VuZVZpZXcgZnJvbSBcImVzcmkvdmlld3MvU2NlbmVWaWV3XCI7XHJcbmltcG9ydCAqIGFzIEdyYXBoaWNzTGF5ZXIgZnJvbSBcImVzcmkvbGF5ZXJzL0dyYXBoaWNzTGF5ZXJcIjtcclxuaW1wb3J0ICogYXMgcHJvbWlzZVV0aWxzIGZyb20gXCJlc3JpL2NvcmUvcHJvbWlzZVV0aWxzXCI7XHJcbmltcG9ydCAqIGFzIGVzcmlSZXF1ZXN0IGZyb20gXCJlc3JpL3JlcXVlc3RcIjtcclxuaW1wb3J0ICogYXMgRXh0ZW50IGZyb20gXCJlc3JpL2dlb21ldHJ5L0V4dGVudFwiO1xyXG5pbXBvcnQgKiBhcyB3ZWJNZXJjYXRvclV0aWxzIGZyb20gXCJlc3JpL2dlb21ldHJ5L3N1cHBvcnQvd2ViTWVyY2F0b3JVdGlsc1wiO1xyXG5pbXBvcnQgKiBhcyB3YXRjaFV0aWxzIGZyb20gXCJlc3JpL2NvcmUvd2F0Y2hVdGlsc1wiO1xyXG5pbXBvcnQgKiBhcyBTcGF0aWFsUmVmZXJlbmNlIGZyb20gXCJlc3JpL2dlb21ldHJ5L1NwYXRpYWxSZWZlcmVuY2VcIjtcclxuaW1wb3J0ICogYXMgUG9pbnQgZnJvbSBcImVzcmkvZ2VvbWV0cnkvUG9pbnRcIjtcclxuaW1wb3J0ICogYXMgYXNkIGZyb20gXCJlc3JpL2NvcmUvYWNjZXNzb3JTdXBwb3J0L2RlY29yYXRvcnNcIjtcclxuaW1wb3J0ICogYXMgcXVlcnkgZnJvbSBcImRvam8vcXVlcnlcIjtcclxuXHJcbi8qKiBcclxuICAgIFRoZSBhdmFpbGFibGUgZGlzcGxheSBvcHRpb25zIHRvIGNoYW5lZyB0aGUgcGFydGljbGUgcmVuZGVyaW5nXHJcbiovXHJcbmV4cG9ydCBpbnRlcmZhY2UgRGlzcGxheU9wdGlvbnMgeyBcclxuICAgIG1pblZlbG9jaXR5PzogbnVtYmVyO1xyXG4gICAgbWF4VmVsb2NpdHk/OiBudW1iZXI7XHJcbiAgICB2ZWxvY2l0eVNjYWxlPzogbnVtYmVyO1xyXG4gICAgcGFydGljbGVBZ2U/OiBudW1iZXI7XHJcbiAgICBwYXJ0aWNsZUxpbmVXaWR0aD86IG51bWJlcjtcclxuICAgIHBhcnRpY2xlTXVsdGlwbGllcj86IG51bWJlcjtcclxuICAgIGZyYW1lUmF0ZT86IG51bWJlcjtcclxuICAgIGNvbG9yU2NhbGU/OiBzdHJpbmdbXTtcclxuICAgIGxpbmVXaWR0aD86IG51bWJlcjtcclxufVxyXG5cclxuLyoqXHJcbiBUaGUgcmV0dXJuIG9iamVjdCBmcm9tIHRoZSBwb2ludC1yZXBvcnQgZXZlbnRcclxuKi9cclxuaW50ZXJmYWNlIFBvaW50UmVwb3J0IHtcclxuICAgIHBvaW50OiBQb2ludDtcclxuICAgIGRpcmVjdGlvbj86IG51bWJlcjtcclxuICAgIHNwZWVkPzogbnVtYmVyO1xyXG59XHJcblxyXG5pbnRlcmZhY2UgQW5pbWF0ZWRFbnZpcm9ubWVudExheWVyUHJvcGVydGllcyBleHRlbmRzIF9fZXNyaS5HcmFwaGljc0xheWVyUHJvcGVydGllcyB7XHJcbiAgICBhY3RpdmVWaWV3PzogTWFwVmlldyB8IFNjZW5lVmlldztcclxuICAgIHVybDogc3RyaW5nO1xyXG4gICAgZGlzcGxheU9wdGlvbnM/OiBEaXNwbGF5T3B0aW9ucztcclxuICAgIHJlcG9ydFZhbHVlcz86IGJvb2xlYW47XHJcbn1cclxuXHJcbkBhc2Quc3ViY2xhc3MoXCJBbmltYXRlZEVudmlyb25tZW50TGF5ZXJcIilcclxuZXhwb3J0IGNsYXNzIEFuaW1hdGVkRW52aXJvbm1lbnRMYXllciBleHRlbmRzIGFzZC5kZWNsYXJlZChHcmFwaGljc0xheWVyKSB7XHJcblxyXG4gICAgQGFzZC5wcm9wZXJ0eSgpXHJcbiAgICB1cmw6IHN0cmluZztcclxuXHJcbiAgICBAYXNkLnByb3BlcnR5KClcclxuICAgIGRpc3BsYXlPcHRpb25zOiBEaXNwbGF5T3B0aW9ucztcclxuXHJcbiAgICBAYXNkLnByb3BlcnR5KClcclxuICAgIHJlcG9ydFZhbHVlczogYm9vbGVhbjtcclxuXHJcbiAgICBwcml2YXRlIF93aW5keTogV2luZHk7XHJcbiAgICBwcml2YXRlIF9kYXRhRmV0Y2hSZXF1aXJlZDogYm9vbGVhbjtcclxuXHJcbiAgICBwcml2YXRlIF9jYW52YXMyZDogSFRNTENhbnZhc0VsZW1lbnQ7XHJcbiAgICBwcml2YXRlIF9jYW52YXMzZDogSFRNTENhbnZhc0VsZW1lbnQ7XHJcblxyXG4gICAgcHJpdmF0ZSBfbGF5ZXJWaWV3MmQ6IGFueTtcclxuICAgIHByaXZhdGUgX2xheWVyVmlldzNkOiBhbnk7XHJcblxyXG4gICAgcHJpdmF0ZSBfc291dGhXZXN0OiBQb2ludDtcclxuICAgIHByaXZhdGUgX25vcnRoRWFzdDogUG9pbnQ7XHJcblxyXG4gICAgcHJpdmF0ZSBfYWN0aXZlVmlldzogTWFwVmlldyB8IFNjZW5lVmlldztcclxuICAgIHByaXZhdGUgX3ZpZXdMb2FkQ291bnQ6IG51bWJlciA9IDA7XHJcblxyXG4gICAgY29uc3RydWN0b3IocHJvcGVydGllczogQW5pbWF0ZWRFbnZpcm9ubWVudExheWVyUHJvcGVydGllcykge1xyXG4gICAgICAgIHN1cGVyKHByb3BlcnRpZXMpO1xyXG5cclxuICAgICAgICAvLyBJZiB0aGUgYWN0aXZlIHZpZXcgaXMgc2V0IGluIHByb3BlcnRpZXMsIHRoZW4gc2V0IGl0IGhlcmUuXHJcbiAgICAgICAgdGhpcy5fYWN0aXZlVmlldyA9IHByb3BlcnRpZXMuYWN0aXZlVmlldztcclxuICAgICAgICB0aGlzLnVybCA9IHByb3BlcnRpZXMudXJsO1xyXG4gICAgICAgIHRoaXMuZGlzcGxheU9wdGlvbnMgPSBwcm9wZXJ0aWVzLmRpc3BsYXlPcHRpb25zO1xyXG4gICAgICAgIHRoaXMucmVwb3J0VmFsdWVzID0gcHJvcGVydGllcy5yZXBvcnRWYWx1ZXMgPT09IGZhbHNlID8gZmFsc2UgOiB0cnVlOyAvLyBkZWZhdWx0IHRvIHRydWVcclxuXHJcbiAgICAgICAgdGhpcy5vbihcImxheWVydmlldy1jcmVhdGVcIiwgKGV2dCkgPT4gdGhpcy5fbGF5ZXJWaWV3Q3JlYXRlZChldnQpKTtcclxuXHJcbiAgICAgICAgLy8gd2F0Y2ggdXJsIHByb3Agc28gYSBmZXRjaCBvZiBkYXRhIGFuZCByZWRyYXcgd2lsbCBvY2N1ci5cclxuICAgICAgICB3YXRjaFV0aWxzLndhdGNoKHRoaXMsIFwidXJsXCIsIChhLCBiLCBjLCBkKSA9PiB0aGlzLl91cmxDaGFuZ2VkKGEsIGIsIGMsIGQpKTtcclxuXHJcbiAgICAgICAgLy8gd2F0Y2ggZGlzcGxheSBvcHRpb25zIHNvIHRvIHJlZHJhdyB3aGVuIGNoYW5nZWQuXHJcbiAgICAgICAgd2F0Y2hVdGlscy53YXRjaCh0aGlzLCBcImRpc3BsYXlPcHRpb25zXCIsIChhLCBiLCBjLCBkKSA9PiB0aGlzLl9kaXNwbGF5T3B0aW9uc0NoYW5nZWQoYSwgYiwgYywgZCkpO1xyXG4gICAgICAgIHRoaXMuX2RhdGFGZXRjaFJlcXVpcmVkID0gdHJ1ZTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFN0YXJ0IGEgZHJhd1xyXG4gICAgICovXHJcbiAgICBkcmF3KCkge1xyXG5cclxuICAgICAgICB0aGlzLl9zZXR1cERyYXcodGhpcy5fYWN0aXZlVmlldy53aWR0aCwgdGhpcy5fYWN0aXZlVmlldy5oZWlnaHQpO1xyXG5cclxuICAgICAgICAvLyBpZiBkYXRhIHNob3VsZCBiZSBmZXRjaGVkLCBnbyBnZXQgaXQgbm93LlxyXG4gICAgICAgIGlmICh0aGlzLl9kYXRhRmV0Y2hSZXF1aXJlZCkge1xyXG4gICAgICAgICAgICBlc3JpUmVxdWVzdCh0aGlzLnVybCwge1xyXG4gICAgICAgICAgICAgICAgcmVzcG9uc2VUeXBlOiBcImpzb25cIlxyXG4gICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICAudGhlbigocmVzcG9uc2UpID0+IHtcclxuICAgICAgICAgICAgICAgIHRoaXMuX2RhdGFGZXRjaFJlcXVpcmVkID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl93aW5keS5zZXREYXRhKHJlc3BvbnNlLmRhdGEpXHJcbiAgICAgICAgICAgICAgICB0aGlzLl9kb0RyYXcoKTsgLy8gYWxsIHNvcnRlZCBkcmF3IG5vdy5cclxuICAgICAgICAgICAgfSlcclxuICAgICAgICAgICAgLm90aGVyd2lzZSgoZXJyKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3Igb2NjdXJyZWQgcmV0cmlldmluZyBkYXRhLiBcIiArIGVycik7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgLy8gbm8gbmVlZCBmb3IgZGF0YSwganVzdCBkcmF3LlxyXG4gICAgICAgICAgICB0aGlzLl9kb0RyYXcoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBVcGRhdGUgdGhlIGFjdGl2ZSB2aWV3LiBUaGUgdmlldyBtdXN0IGhhdmUgYmVlbiBhc3NpZ25lZCB0byB0aGUgbWFwIHByZXZpb3VzbHkgc28gdGhhdCB0aGlzIGxheWVyIGhhcyBjcmVhdGVkIG9yIHVzZWQgdGhlIGNhbnZhcyBlbGVtZW50IGluIGxheWVydmlldyBjcmVhdGVkIGFscmVhZHkuXHJcbiAgICAgKiBAcGFyYW0gdmlld1xyXG4gICAgICovXHJcbiAgICBzZXRWaWV3KHZpZXc6IE1hcFZpZXcgfCBTY2VuZVZpZXcpIHtcclxuICAgICAgICB0aGlzLl9hY3RpdmVWaWV3ID0gdmlldztcclxuICAgICAgICB0aGlzLmRyYXcoKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIElzIHRoZSBhY3RpdmUgdmlldyAyZC5cclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBfaXMyZCgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5fYWN0aXZlVmlldyA/IHRoaXMuX2FjdGl2ZVZpZXcudHlwZSA9PT0gXCIyZFwiIDogZmFsc2U7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDYWxsIHRoZSB3aW5keSBkcmF3IG1ldGhvZFxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF9kb0RyYXcoKSB7XHJcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLl9pczJkKCkpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuX3dpbmR5LnN0YXJ0KFxyXG4gICAgICAgICAgICAgICAgICAgIFtbMCwgMF0sIFt0aGlzLl9jYW52YXMyZC53aWR0aCwgdGhpcy5fY2FudmFzMmQuaGVpZ2h0XV0sXHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fY2FudmFzMmQud2lkdGgsXHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fY2FudmFzMmQuaGVpZ2h0LFxyXG4gICAgICAgICAgICAgICAgICAgIFtbdGhpcy5fc291dGhXZXN0LngsIHRoaXMuX3NvdXRoV2VzdC55XSwgW3RoaXMuX25vcnRoRWFzdC54LCB0aGlzLl9ub3J0aEVhc3QueV1dXHJcbiAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSwgNTAwKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEluaXQgdGhlIHdpbmR5IGNsYXNzIFxyXG4gICAgICogQHBhcmFtIGRhdGFcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBfaW5pdFdpbmR5KGRhdGE/KSB7XHJcbiAgICAgICAgaWYgKHRoaXMuX2lzMmQoKSkge1xyXG4gICAgICAgICAgICB0aGlzLl93aW5keSA9IG5ldyBXaW5keShcclxuICAgICAgICAgICAgICAgIHRoaXMuX2NhbnZhczJkLFxyXG4gICAgICAgICAgICAgICAgdW5kZWZpbmVkLFxyXG4gICAgICAgICAgICAgICAgdGhpcy5kaXNwbGF5T3B0aW9ucyk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogU2V0dXAgdGhlIGdlbyBib3VuZHMgb2YgdGhlIGRyYXdpbmcgYXJlYVxyXG4gICAgICogQHBhcmFtIHdpZHRoXHJcbiAgICAgKiBAcGFyYW0gaGVpZ2h0XHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgX3NldHVwRHJhdyh3aWR0aDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlcikge1xyXG5cclxuICAgICAgICAvLyB1c2UgdGhlIGV4dGVudCBvZiB0aGUgdmlldywgYW5kIG5vdCB0aGUgZXh0ZW50IHBhc3NlZCBpbnRvIGZldGNoSW1hZ2UuLi5pdCB3YXMgc2xpZ2h0bHkgb2ZmIHdoZW4gaXQgY3Jvc3NlZCBJREwuXHJcbiAgICAgICAgbGV0IGV4dGVudCA9IHRoaXMuX2FjdGl2ZVZpZXcuZXh0ZW50O1xyXG4gICAgICAgIGlmIChleHRlbnQuc3BhdGlhbFJlZmVyZW5jZS5pc1dlYk1lcmNhdG9yKSB7XHJcbiAgICAgICAgICAgIGV4dGVudCA9IDxFeHRlbnQ+d2ViTWVyY2F0b3JVdGlscy53ZWJNZXJjYXRvclRvR2VvZ3JhcGhpYyhleHRlbnQpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5fbm9ydGhFYXN0ID0gbmV3IFBvaW50KHsgeDogZXh0ZW50LnhtYXgsIHk6IGV4dGVudC55bWF4IH0pO1xyXG4gICAgICAgIHRoaXMuX3NvdXRoV2VzdCA9IG5ldyBQb2ludCh7IHg6IGV4dGVudC54bWluLCB5OiBleHRlbnQueW1pbiB9KTtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuX2lzMmQoKSkge1xyXG4gICAgICAgICAgICB0aGlzLl9jYW52YXMyZC53aWR0aCA9IHdpZHRoO1xyXG4gICAgICAgICAgICB0aGlzLl9jYW52YXMyZC5oZWlnaHQgPSBoZWlnaHQ7XHJcbiAgICAgICAgICAgIC8vIGNhdGVyIGZvciB0aGUgZXh0ZW50IGNyb3NzaW5nIHRoZSBJRExcclxuICAgICAgICAgICAgaWYgKHRoaXMuX3NvdXRoV2VzdC54ID4gdGhpcy5fbm9ydGhFYXN0LnggJiYgdGhpcy5fbm9ydGhFYXN0LnggPCAwKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9ub3J0aEVhc3QueCA9IDM2MCArIHRoaXMuX25vcnRoRWFzdC54O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogSGFuZGxlIGxheWVyIHZpZXcgY3JlYXRlZC5cclxuICAgICAqIEBwYXJhbSBldnRcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBfbGF5ZXJWaWV3Q3JlYXRlZChldnQpIHtcclxuICAgICAgICAvLyBzZXQgdGhlIGFjdGl2ZSB2aWV3IHRvIHRoZSBmaXJzdCB2aWV3IGxvYWRlZCBpZiB0aGVyZSB3YXNuJ3Qgb25lIGluY2x1ZGVkIGluIHRoZSBjb25zdHJ1Y3RvciBwcm9wZXJ0aWVzLlxyXG4gICAgICAgIHRoaXMuX3ZpZXdMb2FkQ291bnQrKztcclxuICAgICAgICBpZiAodGhpcy5fdmlld0xvYWRDb3VudCA9PT0gMSAmJiAhdGhpcy5fYWN0aXZlVmlldykge1xyXG4gICAgICAgICAgICB0aGlzLl9hY3RpdmVWaWV3ID0gZXZ0LmxheWVyVmlldy52aWV3O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHRoaXMuX2lzMmQoKSkge1xyXG4gICAgICAgICAgICB0aGlzLl9sYXllclZpZXcyZCA9IGV2dC5sYXllclZpZXc7XHJcbiAgICAgICAgICAgIC8vIGZvciBtYXAgdmlld3MsIHdhaXQgZm9yIHRoZSBsYXllcnZpZXcgdG8gYmUgYXR0YWNoZWRcclxuICAgICAgICAgICAgd2F0Y2hVdGlscy53aGVuVHJ1ZU9uY2UoZXZ0LmxheWVyVmlldywgXCJhdHRhY2hlZFwiLCAoKSA9PiB0aGlzLl9jcmVhdGVDYW52YXMoZXZ0LmxheWVyVmlldykpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5fbGF5ZXJWaWV3M2QgPSBldnQubGF5ZXJWaWV3O1xyXG4gICAgICAgICAgICB0aGlzLl9jcmVhdGVDYW52YXMoZXZ0LmxheWVyVmlldyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHdhdGNoVXRpbHMucGF1c2FibGUoZXZ0LmxheWVyVmlldy52aWV3LCBcInN0YXRpb25hcnlcIiwgKGlzU3RhdGlvbmFyeSwgYiwgYywgdmlldykgPT4gdGhpcy5fdmlld1N0YXRpb25hcnkoaXNTdGF0aW9uYXJ5LCBiLCBjLCB2aWV3KSk7XHJcblxyXG4gICAgICAgIGlmICh0aGlzLnJlcG9ydFZhbHVlcyA9PT0gdHJ1ZSkge1xyXG4gICAgICAgICAgICBldnQubGF5ZXJWaWV3LnZpZXcub24oXCJwb2ludGVyLW1vdmVcIiwgKGV2dCkgPT4gdGhpcy5fdmlld1BvaW50ZXJNb3ZlKGV2dCkpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGUgb3IgYXNzaWduIGEgY2FudmFzIGVsZW1lbnQgZm9yIHVzZSBpbiBkcmF3aW5nLlxyXG4gICAgICogQHBhcmFtIGxheWVyVmlld1xyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF9jcmVhdGVDYW52YXMobGF5ZXJWaWV3KSB7XHJcbiAgICAgICAgaWYgKHRoaXMuX2lzMmQoKSkge1xyXG4gICAgICAgICAgICAvLyBGb3IgYSBtYXAgdmlldyBnZXQgdGhlIGNvbnRhaW5lciBlbGVtZW50IG9mIHRoZSBsYXllciB2aWV3IGFuZCBhZGQgYSBjYW52YXMgdG8gaXQuXHJcbiAgICAgICAgICAgIHRoaXMuX2NhbnZhczJkID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImNhbnZhc1wiKTtcclxuICAgICAgICAgICAgbGF5ZXJWaWV3LmNvbnRhaW5lci5lbGVtZW50LmFwcGVuZENoaWxkKHRoaXMuX2NhbnZhczJkKTtcclxuXHJcbiAgICAgICAgICAgIC8vIGRlZmF1bHQgc29tZSBzdHlsZXMgXHJcbiAgICAgICAgICAgIHRoaXMuX2NhbnZhczJkLnN0eWxlLnBvc2l0aW9uID0gXCJhYnNvbHV0ZVwiO1xyXG4gICAgICAgICAgICB0aGlzLl9jYW52YXMyZC5zdHlsZS5sZWZ0ID0gXCIwXCI7XHJcbiAgICAgICAgICAgIHRoaXMuX2NhbnZhczJkLnN0eWxlLnRvcCA9IFwiMFwiO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgLy8gSGFuZGxlIHNjZW5lIHZpZXcgY2FudmFzIGluIGZ1dHVyZS4gICAgICAgICAgICBcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIHNldHVwIHdpbmR5IG9uY2UgdGhlIGNhbnZhcyBoYXMgYmVlbiBjcmVhdGVkXHJcbiAgICAgICAgdGhpcy5faW5pdFdpbmR5KCk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiB2aWV3IHN0YXRpb25hcnkgaGFuZGxlciwgY2xlYXIgY2FudmFzIG9yIGZvcmNlIGEgcmVkcmF3XHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgX3ZpZXdTdGF0aW9uYXJ5KGlzU3RhdGlvbmFyeSwgYiwgYywgdmlldykge1xyXG4gICAgICAgIGlmICghdGhpcy5fYWN0aXZlVmlldykgcmV0dXJuO1xyXG5cclxuICAgICAgICBpZiAoIWlzU3RhdGlvbmFyeSkge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5fd2luZHkpIHtcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9pczJkKCkpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl93aW5keS5zdG9wKCk7IC8vIGZvcmNlIGEgc3RvcCBvZiB3aW5keSB3aGVuIHZpZXcgaXMgbW92aW5nXHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fY2FudmFzMmQuZ2V0Q29udGV4dChcIjJkXCIpLmNsZWFyUmVjdCgwLCAwLCB0aGlzLl9hY3RpdmVWaWV3LndpZHRoLCB0aGlzLl9hY3RpdmVWaWV3LmhlaWdodCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuZHJhdygpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF92aWV3UG9pbnRlck1vdmUoZXZ0KSB7XHJcbiAgICAgICAgaWYgKCF0aGlzLl93aW5keSkgcmV0dXJuO1xyXG5cclxuICAgICAgICBsZXQgbW91c2VQb3MgPSB0aGlzLl9nZXRNb3VzZVBvcyhldnQpO1xyXG4gICAgICAgIGxldCBwb2ludCA9IHRoaXMuX2FjdGl2ZVZpZXcudG9NYXAoeyB4OiBtb3VzZVBvcy54LCB5OiBtb3VzZVBvcy55IH0pO1xyXG4gICAgICAgIGlmIChwb2ludC5zcGF0aWFsUmVmZXJlbmNlLmlzV2ViTWVyY2F0b3IpIHtcclxuICAgICAgICAgICAgcG9pbnQgPSA8UG9pbnQ+d2ViTWVyY2F0b3JVdGlscy53ZWJNZXJjYXRvclRvR2VvZ3JhcGhpYyhwb2ludCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgZ3JpZCA9IHRoaXMuX3dpbmR5LmludGVycG9sYXRlKHBvaW50LngsIHBvaW50LnkpO1xyXG4gICAgICAgIGxldCByZXN1bHQ6IFBvaW50UmVwb3J0ID0ge1xyXG4gICAgICAgICAgICBwb2ludDogcG9pbnRcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICBpZiAoIWdyaWQgfHwgKGlzTmFOKGdyaWRbMF0pIHx8IGlzTmFOKGdyaWRbMV0pIHx8ICFncmlkWzJdKSkge1xyXG4gICAgICAgICAgICAvLyB0aGUgY3VycmVudCBwb2ludCBjb250YWlucyBubyBkYXRhIGluIHRoZSB3aW5keSBncmlkLCBzbyBlbWl0IGFuIHVuZGVmaW5lZCBvYmplY3RcclxuICAgICAgICAgICAgdGhpc1tcImVtaXRcIl0oXCJwb2ludC1yZXBvcnRcIiwgcmVzdWx0KTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gZ2V0IHRoZSBzcGVlZCBhbmQgZGlyZWN0aW9uIGFuZCBlbWl0IHRoZSByZXN1bHRcclxuICAgICAgICByZXN1bHQuc3BlZWQgPSB0aGlzLl92ZWN0b3JUb1NwZWVkKGdyaWRbMF0sIGdyaWRbMV0pO1xyXG4gICAgICAgIHJlc3VsdC5kaXJlY3Rpb24gPSB0aGlzLl92ZWN0b3JUb0RlZ3JlZXMoZ3JpZFswXSwgZ3JpZFsxXSk7XHJcbiAgICAgICAgdGhpc1tcImVtaXRcIl0oXCJwb2ludC1yZXBvcnRcIiwgcmVzdWx0KTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENvbnZlcnQgdGhlIHdpbmR5IHZlY3RvciBkYXRhIHRvIG1ldGVycyBwZXIgc2Vjb25kXHJcbiAgICAgKiBAcGFyYW0gdU1zXHJcbiAgICAgKiBAcGFyYW0gdk1zXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgX3ZlY3RvclRvU3BlZWQodU1zLCB2TXMpIHtcclxuICAgICAgICBsZXQgc3BlZWRBYnMgPSBNYXRoLnNxcnQoTWF0aC5wb3codU1zLCAyKSArIE1hdGgucG93KHZNcywgMikpO1xyXG4gICAgICAgIHJldHVybiBzcGVlZEFicztcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFJldHVybiB0aGUgd2luZHkgdmVjdG9yIGRhdGEgYXMgYSBkaXJlY3Rpb24uIFJldHVybnMgdGhlIGRpcmVjdGlvbiBpbiB0aGUgZmxvdyBvZiB0aGUgZGF0YSBpbiB3dGggdGhlIGRlZ3JlZXMgaW4gYSBjbG9ja3dpc2UgZGlyZWN0aW9uLlxyXG4gICAgICogQHBhcmFtIHVNc1xyXG4gICAgICogQHBhcmFtIHZNc1xyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF92ZWN0b3JUb0RlZ3JlZXModU1zLCB2TXMpIHtcclxuXHJcbiAgICAgICAgbGV0IGFicyA9IE1hdGguc3FydChNYXRoLnBvdyh1TXMsIDIpICsgTWF0aC5wb3codk1zLCAyKSk7XHJcbiAgICAgICAgbGV0IGRpcmVjdGlvbiA9IE1hdGguYXRhbjIodU1zIC8gYWJzLCB2TXMgLyBhYnMpO1xyXG4gICAgICAgIGxldCBkaXJlY3Rpb25Ub0RlZ3JlZXMgPSBkaXJlY3Rpb24gKiAxODAgLyBNYXRoLlBJICsgMTgwO1xyXG5cclxuICAgICAgICBkaXJlY3Rpb25Ub0RlZ3JlZXMgKz0gMTgwO1xyXG4gICAgICAgIGlmIChkaXJlY3Rpb25Ub0RlZ3JlZXMgPj0gMzYwKSBkaXJlY3Rpb25Ub0RlZ3JlZXMgLT0gMzYwO1xyXG5cclxuICAgICAgICByZXR1cm4gZGlyZWN0aW9uVG9EZWdyZWVzO1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICBwcml2YXRlIF9nZXRNb3VzZVBvcyhldnQpIHtcclxuICAgICAgICAvLyBjb250YWluZXIgb24gdGhlIHZpZXcgaXMgYWN0dWFsbHkgYSBodG1sIGVsZW1lbnQgYXQgdGhpcyBwb2ludCwgbm90IGEgc3RyaW5nIGFzIHRoZSB0eXBpbmdzIHN1Z2dlc3QuXHJcbiAgICAgICAgbGV0IGNvbnRhaW5lcjogYW55ID0gdGhpcy5fYWN0aXZlVmlldy5jb250YWluZXI7XHJcbiAgICAgICAgbGV0IHJlY3QgPSBjb250YWluZXIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgeDogZXZ0LnggLSByZWN0LmxlZnQsXHJcbiAgICAgICAgICAgIHk6IGV2dC55IC0gcmVjdC50b3BcclxuICAgICAgICB9O1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICAvKipcclxuICAgICAqIFdhdGNoIG9mIHRoZSB1cmwgcHJvcGVydHkgLSBjYWxsIGRyYXcgYWdhaW4gd2l0aCBhIHJlZmV0Y2hcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBfdXJsQ2hhbmdlZChhLCBiLCBjLCBkKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuX3dpbmR5KSB0aGlzLl93aW5keS5zdG9wKCk7XHJcbiAgICAgICAgdGhpcy5fZGF0YUZldGNoUmVxdWlyZWQgPSB0cnVlO1xyXG4gICAgICAgIHRoaXMuZHJhdygpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogV2F0Y2ggb2YgZGlzcGxheU9wdGlvbnMgLSBjYWxsIGRyYXcgYWdhaW4gd2l0aCBuZXcgb3B0aW9ucyBzZXQgb24gd2luZHkuXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgX2Rpc3BsYXlPcHRpb25zQ2hhbmdlZChuZXdPcHRpb25zLCBiLCBjLCBkKSB7XHJcbiAgICAgICAgaWYgKCF0aGlzLl93aW5keSkgcmV0dXJuO1xyXG4gICAgICAgIHRoaXMuX3dpbmR5LnN0b3AoKTtcclxuICAgICAgICB0aGlzLl93aW5keS5zZXREaXNwbGF5T3B0aW9ucyhuZXdPcHRpb25zKTtcclxuICAgICAgICB0aGlzLmRyYXcoKTtcclxuICAgIH1cclxufVxyXG5cclxuXHJcblxyXG4vKiAgR2xvYmFsIGNsYXNzIGZvciBzaW11bGF0aW5nIHRoZSBtb3ZlbWVudCBvZiBwYXJ0aWNsZSB0aHJvdWdoIGEgMWttIHdpbmQgZ3JpZFxyXG4gY3JlZGl0OiBBbGwgdGhlIGNyZWRpdCBmb3IgdGhpcyB3b3JrIGdvZXMgdG86IGh0dHBzOi8vZ2l0aHViLmNvbS9jYW1iZWNjIGZvciBjcmVhdGluZyB0aGUgcmVwbzpcclxuIGh0dHBzOi8vZ2l0aHViLmNvbS9jYW1iZWNjL2VhcnRoLiBUaGUgbWFqb3JpdHkgb2YgdGhpcyBjb2RlIGlzIGRpcmVjdGx5IHRha2UgbmZyb20gdGhlcmUsIHNpbmNlIGl0cyBhd2Vzb21lLlxyXG4gVGhpcyBjbGFzcyB0YWtlcyBhIGNhbnZhcyBlbGVtZW50IGFuZCBhbiBhcnJheSBvZiBkYXRhICgxa20gR0ZTIGZyb20gaHR0cDovL3d3dy5lbWMubmNlcC5ub2FhLmdvdi9pbmRleC5waHA/YnJhbmNoPUdGUylcclxuIGFuZCB0aGVuIHVzZXMgYSBtZXJjYXRvciAoZm9yd2FyZC9yZXZlcnNlKSBwcm9qZWN0aW9uIHRvIGNvcnJlY3RseSBtYXAgd2luZCB2ZWN0b3JzIGluIFwibWFwIHNwYWNlXCIuXHJcbiBUaGUgXCJzdGFydFwiIG1ldGhvZCB0YWtlcyB0aGUgYm91bmRzIG9mIHRoZSBtYXAgYXQgaXRzIGN1cnJlbnQgZXh0ZW50IGFuZCBzdGFydHMgdGhlIHdob2xlIGdyaWRkaW5nLFxyXG4gaW50ZXJwb2xhdGlvbiBhbmQgYW5pbWF0aW9uIHByb2Nlc3MuXHJcblxyXG4gRXh0cmEgY3JlZGl0IHRvIGh0dHBzOi8vZ2l0aHViLmNvbS9kYW53aWxkL2xlYWZsZXQtdmVsb2NpdHkgZm9yIG1vZGlmeWluZyB0aGUgY2xhc3MgdG8gYmUgbW9yZSBjdXN0b21pemFibGUgYW5kIHJldXNhYmxlIGZvciBvdGhlciBzY2VuYXJpb3MuXHJcbiBBbHNvIGNyZWRpdCB0byAtIGh0dHBzOi8vZ2l0aHViLmNvbS9Fc3JpL3dpbmQtanMgXHJcbiAqL1xyXG5jbGFzcyBXaW5keSB7XHJcblxyXG4gICAgTUlOX1ZFTE9DSVRZX0lOVEVOU0lUWTogbnVtYmVyO1xyXG4gICAgTUFYX1ZFTE9DSVRZX0lOVEVOU0lUWTogbnVtYmVyO1xyXG4gICAgVkVMT0NJVFlfU0NBTEU6IG51bWJlcjtcclxuICAgIE1BWF9QQVJUSUNMRV9BR0U6IG51bWJlcjtcclxuICAgIFBBUlRJQ0xFX0xJTkVfV0lEVEg6IG51bWJlcjtcclxuICAgIFBBUlRJQ0xFX01VTFRJUExJRVI6IG51bWJlcjtcclxuICAgIFBBUlRJQ0xFX1JFRFVDVElPTjogbnVtYmVyO1xyXG4gICAgRlJBTUVfUkFURTogbnVtYmVyO1xyXG4gICAgRlJBTUVfVElNRTogbnVtYmVyO1xyXG4gICAgY29sb3JTY2FsZTogYW55O1xyXG4gICAgY2FudmFzOiBIVE1MQ2FudmFzRWxlbWVudDtcclxuXHJcbiAgICBOVUxMX1dJTkRfVkVDVE9SID0gW05hTiwgTmFOLCBudWxsXTsgLy8gc2luZ2xldG9uIGZvciBubyB3aW5kIGluIHRoZSBmb3JtOiBbdSwgdiwgbWFnbml0dWRlXVxyXG5cclxuICAgIHN0YXRpYyBmaWVsZDogYW55O1xyXG4gICAgc3RhdGljIGFuaW1hdGlvbkxvb3A7XHJcblxyXG4gICAgYnVpbGRlcjtcclxuICAgIGdyaWQ7XHJcbiAgICBncmlkRGF0YTogYW55O1xyXG4gICAgZGF0ZTtcclxuICAgIM67MDtcclxuICAgIM+GMDtcclxuICAgIM6Uzrs7XHJcbiAgICDOlM+GO1xyXG4gICAgbmk7XHJcbiAgICBuajtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihjYW52YXM6IEhUTUxDYW52YXNFbGVtZW50LCBkYXRhPzogYW55LCBvcHRpb25zPzogRGlzcGxheU9wdGlvbnMpIHtcclxuXHJcbiAgICAgICAgdGhpcy5jYW52YXMgPSBjYW52YXM7XHJcbiAgICAgICAgaWYgKCFvcHRpb25zKSBvcHRpb25zID0ge307XHJcbiAgICAgICAgdGhpcy5zZXREaXNwbGF5T3B0aW9ucyhvcHRpb25zKTtcclxuICAgICAgICB0aGlzLmdyaWREYXRhID0gZGF0YTtcclxuXHJcbiAgICB9XHJcblxyXG4gICAgc2V0RGF0YShkYXRhKSB7XHJcbiAgICAgICAgdGhpcy5ncmlkRGF0YSA9IGRhdGE7XHJcbiAgICB9XHJcblxyXG4gICAgc2V0RGlzcGxheU9wdGlvbnMob3B0aW9uczogRGlzcGxheU9wdGlvbnMpIHtcclxuICAgICAgICB0aGlzLk1JTl9WRUxPQ0lUWV9JTlRFTlNJVFkgPSBvcHRpb25zLm1pblZlbG9jaXR5IHx8IDA7IC8vIHZlbG9jaXR5IGF0IHdoaWNoIHBhcnRpY2xlIGludGVuc2l0eSBpcyBtaW5pbXVtIChtL3MpXHJcbiAgICAgICAgdGhpcy5NQVhfVkVMT0NJVFlfSU5URU5TSVRZID0gb3B0aW9ucy5tYXhWZWxvY2l0eSB8fCAxMDsgLy8gdmVsb2NpdHkgYXQgd2hpY2ggcGFydGljbGUgaW50ZW5zaXR5IGlzIG1heGltdW0gKG0vcylcclxuICAgICAgICB0aGlzLlZFTE9DSVRZX1NDQUxFID0gKG9wdGlvbnMudmVsb2NpdHlTY2FsZSB8fCAwLjAwNSkgKiAoTWF0aC5wb3cod2luZG93LmRldmljZVBpeGVsUmF0aW8sIDEgLyAzKSB8fCAxKTsgLy8gc2NhbGUgZm9yIHdpbmQgdmVsb2NpdHkgKGNvbXBsZXRlbHkgYXJiaXRyYXJ5LS10aGlzIHZhbHVlIGxvb2tzIG5pY2UpXHJcbiAgICAgICAgdGhpcy5NQVhfUEFSVElDTEVfQUdFID0gb3B0aW9ucy5wYXJ0aWNsZUFnZSB8fCA5MDsgLy8gbWF4IG51bWJlciBvZiBmcmFtZXMgYSBwYXJ0aWNsZSBpcyBkcmF3biBiZWZvcmUgcmVnZW5lcmF0aW9uXHJcbiAgICAgICAgdGhpcy5QQVJUSUNMRV9MSU5FX1dJRFRIID0gb3B0aW9ucy5saW5lV2lkdGggfHwgMTsgLy8gbGluZSB3aWR0aCBvZiBhIGRyYXduIHBhcnRpY2xlXHJcbiAgICAgICAgdGhpcy5QQVJUSUNMRV9NVUxUSVBMSUVSID0gb3B0aW9ucy5wYXJ0aWNsZU11bHRpcGxpZXIgfHwgMSAvIDMwMDsgLy8gcGFydGljbGUgY291bnQgc2NhbGFyIChjb21wbGV0ZWx5IGFyYml0cmFyeS0tdGhpcyB2YWx1ZXMgbG9va3MgbmljZSlcclxuICAgICAgICB0aGlzLlBBUlRJQ0xFX1JFRFVDVElPTiA9IE1hdGgucG93KHdpbmRvdy5kZXZpY2VQaXhlbFJhdGlvLCAxIC8gMykgfHwgMS42OyAvLyBtdWx0aXBseSBwYXJ0aWNsZSBjb3VudCBmb3IgbW9iaWxlcyBieSB0aGlzIGFtb3VudFxyXG4gICAgICAgIHRoaXMuRlJBTUVfUkFURSA9IG9wdGlvbnMuZnJhbWVSYXRlIHx8IDE1O1xyXG4gICAgICAgIHRoaXMuRlJBTUVfVElNRSA9IDEwMDAgLyB0aGlzLkZSQU1FX1JBVEU7IC8vIGRlc2lyZWQgZnJhbWVzIHBlciBzZWNvbmRcclxuXHJcbiAgICAgICAgdmFyIGRlZmF1bHRDb2xvclNjYWxlID0gW1wicmdiKDM2LDEwNCwgMTgwKVwiLCBcInJnYig2MCwxNTcsIDE5NClcIiwgXCJyZ2IoMTI4LDIwNSwxOTMgKVwiLCBcInJnYigxNTEsMjE4LDE2OClcIiwgXCJyZ2IoMTk4LDIzMSwxODEpXCIsIFwicmdiKDIzOCwyNDcsMjE3KVwiLCBcInJnYigyNTUsMjM4LDE1OSlcIiwgXCJyZ2IoMjUyLDIxNywxMjUpXCIsIFwicmdiKDI1NSwxODIsMTAwKVwiLCBcInJnYigyNTIsMTUwLDc1KVwiLCBcInJnYigyNTAsMTEyLDUyKVwiLCBcInJnYigyNDUsNjQsMzIpXCIsIFwicmdiKDIzNyw0NSwyOClcIiwgXCJyZ2IoMjIwLDI0LDMyKVwiLCBcInJnYigxODAsMCwzNSlcIl07XHJcbiAgICAgICAgdGhpcy5jb2xvclNjYWxlID0gb3B0aW9ucy5jb2xvclNjYWxlIHx8IGRlZmF1bHRDb2xvclNjYWxlO1xyXG4gICAgfVxyXG5cclxuICAgIHN0YXJ0KGJvdW5kcywgd2lkdGgsIGhlaWdodCwgZXh0ZW50KSB7XHJcblxyXG4gICAgICAgIGxldCBtYXBCb3VuZHMgPSB7XHJcbiAgICAgICAgICAgIHNvdXRoOiB0aGlzLmRlZzJyYWQoZXh0ZW50WzBdWzFdKSxcclxuICAgICAgICAgICAgbm9ydGg6IHRoaXMuZGVnMnJhZChleHRlbnRbMV1bMV0pLFxyXG4gICAgICAgICAgICBlYXN0OiB0aGlzLmRlZzJyYWQoZXh0ZW50WzFdWzBdKSxcclxuICAgICAgICAgICAgd2VzdDogdGhpcy5kZWcycmFkKGV4dGVudFswXVswXSksXHJcbiAgICAgICAgICAgIHdpZHRoOiB3aWR0aCxcclxuICAgICAgICAgICAgaGVpZ2h0OiBoZWlnaHRcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICB0aGlzLnN0b3AoKTtcclxuXHJcbiAgICAgICAgLy8gYnVpbGQgZ3JpZFxyXG4gICAgICAgIHRoaXMuYnVpbGRHcmlkKHRoaXMuZ3JpZERhdGEsIChncmlkUmVzdWx0KSA9PiB7XHJcbiAgICAgICAgICAgIGxldCBidWlsdEJvdW5kcyA9IHRoaXMuYnVpbGRCb3VuZHMoYm91bmRzLCB3aWR0aCwgaGVpZ2h0KTtcclxuICAgICAgICAgICAgdGhpcy5pbnRlcnBvbGF0ZUZpZWxkKGdyaWRSZXN1bHQsIGJ1aWx0Qm91bmRzLCBtYXBCb3VuZHMsIChib3VuZHMsIGZpZWxkKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAvLyBhbmltYXRlIHRoZSBjYW52YXMgd2l0aCByYW5kb20gcG9pbnRzXHJcbiAgICAgICAgICAgICAgICBXaW5keS5maWVsZCA9IGZpZWxkO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hbmltYXRlKGJvdW5kcywgV2luZHkuZmllbGQpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBzdG9wKCkge1xyXG4gICAgICAgIGlmIChXaW5keS5maWVsZCkgV2luZHkuZmllbGQucmVsZWFzZSgpO1xyXG4gICAgICAgIGlmIChXaW5keS5hbmltYXRpb25Mb29wKSBjYW5jZWxBbmltYXRpb25GcmFtZShXaW5keS5hbmltYXRpb25Mb29wKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICogR2V0IGludGVycG9sYXRlZCBncmlkIHZhbHVlIGZyb20gTG9uL0xhdCBwb3NpdGlvblxyXG4gICAqIEBwYXJhbSDOuyB7RmxvYXR9IExvbmdpdHVkZVxyXG4gICAqIEBwYXJhbSDPhiB7RmxvYXR9IExhdGl0dWRlXHJcbiAgICogQHJldHVybnMge09iamVjdH1cclxuICAgKi9cclxuICAgIGludGVycG9sYXRlKM67LCDPhikge1xyXG5cclxuICAgICAgICBpZiAoIXRoaXMuZ3JpZCkgcmV0dXJuIG51bGw7XHJcblxyXG4gICAgICAgIGxldCBpID0gdGhpcy5mbG9vck1vZCjOuyAtIHRoaXMuzrswLCAzNjApIC8gdGhpcy7OlM67OyAvLyBjYWxjdWxhdGUgbG9uZ2l0dWRlIGluZGV4IGluIHdyYXBwZWQgcmFuZ2UgWzAsIDM2MClcclxuICAgICAgICBsZXQgaiA9ICh0aGlzLs+GMCAtIM+GKSAvIHRoaXMuzpTPhjsgLy8gY2FsY3VsYXRlIGxhdGl0dWRlIGluZGV4IGluIGRpcmVjdGlvbiArOTAgdG8gLTkwXHJcblxyXG4gICAgICAgIGxldCBmaSA9IE1hdGguZmxvb3IoaSksXHJcbiAgICAgICAgICAgIGNpID0gZmkgKyAxO1xyXG4gICAgICAgIGxldCBmaiA9IE1hdGguZmxvb3IoaiksXHJcbiAgICAgICAgICAgIGNqID0gZmogKyAxO1xyXG5cclxuICAgICAgICBsZXQgcm93O1xyXG4gICAgICAgIGlmIChyb3cgPSB0aGlzLmdyaWRbZmpdKSB7XHJcbiAgICAgICAgICAgIHZhciBnMDAgPSByb3dbZmldO1xyXG4gICAgICAgICAgICB2YXIgZzEwID0gcm93W2NpXTtcclxuICAgICAgICAgICAgaWYgKHRoaXMuaXNWYWx1ZShnMDApICYmIHRoaXMuaXNWYWx1ZShnMTApICYmIChyb3cgPSB0aGlzLmdyaWRbY2pdKSkge1xyXG4gICAgICAgICAgICAgICAgdmFyIGcwMSA9IHJvd1tmaV07XHJcbiAgICAgICAgICAgICAgICB2YXIgZzExID0gcm93W2NpXTtcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmlzVmFsdWUoZzAxKSAmJiB0aGlzLmlzVmFsdWUoZzExKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIEFsbCBmb3VyIHBvaW50cyBmb3VuZCwgc28gaW50ZXJwb2xhdGUgdGhlIHZhbHVlLlxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmJ1aWxkZXIuaW50ZXJwb2xhdGUoaSAtIGZpLCBqIC0gZmosIGcwMCwgZzEwLCBnMDEsIGcxMSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBidWlsZEdyaWQoZGF0YSwgY2FsbGJhY2spIHtcclxuXHJcbiAgICAgICAgdGhpcy5idWlsZGVyID0gdGhpcy5jcmVhdGVCdWlsZGVyKGRhdGEpO1xyXG4gICAgICAgIHZhciBoZWFkZXIgPSB0aGlzLmJ1aWxkZXIuaGVhZGVyO1xyXG5cclxuICAgICAgICB0aGlzLs67MCA9IGhlYWRlci5sbzE7XHJcbiAgICAgICAgdGhpcy7PhjAgPSBoZWFkZXIubGExOyAvLyB0aGUgZ3JpZCdzIG9yaWdpbiAoZS5nLiwgMC4wRSwgOTAuME4pXHJcblxyXG4gICAgICAgIHRoaXMuzpTOuyA9IGhlYWRlci5keDtcclxuICAgICAgICB0aGlzLs6Uz4YgPSBoZWFkZXIuZHk7IC8vIGRpc3RhbmNlIGJldHdlZW4gZ3JpZCBwb2ludHMgKGUuZy4sIDIuNSBkZWcgbG9uLCAyLjUgZGVnIGxhdClcclxuXHJcbiAgICAgICAgdGhpcy5uaSA9IGhlYWRlci5ueDtcclxuICAgICAgICB0aGlzLm5qID0gaGVhZGVyLm55OyAvLyBudW1iZXIgb2YgZ3JpZCBwb2ludHMgVy1FIGFuZCBOLVMgKGUuZy4sIDE0NCB4IDczKVxyXG5cclxuICAgICAgICB0aGlzLmRhdGUgPSBuZXcgRGF0ZShoZWFkZXIucmVmVGltZSk7XHJcbiAgICAgICAgdGhpcy5kYXRlLnNldEhvdXJzKHRoaXMuZGF0ZS5nZXRIb3VycygpICsgaGVhZGVyLmZvcmVjYXN0VGltZSk7XHJcblxyXG4gICAgICAgIC8vIFNjYW4gbW9kZSAwIGFzc3VtZWQuIExvbmdpdHVkZSBpbmNyZWFzZXMgZnJvbSDOuzAsIGFuZCBsYXRpdHVkZSBkZWNyZWFzZXMgZnJvbSDPhjAuXHJcbiAgICAgICAgLy8gaHR0cDovL3d3dy5uY28ubmNlcC5ub2FhLmdvdi9wbWIvZG9jcy9ncmliMi9ncmliMl90YWJsZTMtNC5zaHRtbFxyXG4gICAgICAgIHRoaXMuZ3JpZCA9IFtdO1xyXG4gICAgICAgIHZhciBwID0gMDtcclxuICAgICAgICB2YXIgaXNDb250aW51b3VzID0gTWF0aC5mbG9vcih0aGlzLm5pICogdGhpcy7OlM67KSA+PSAzNjA7XHJcblxyXG4gICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgdGhpcy5uajsgaisrKSB7XHJcbiAgICAgICAgICAgIHZhciByb3cgPSBbXTtcclxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLm5pOyBpKysgLCBwKyspIHtcclxuICAgICAgICAgICAgICAgIHJvd1tpXSA9IHRoaXMuYnVpbGRlci5kYXRhKHApO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmIChpc0NvbnRpbnVvdXMpIHtcclxuICAgICAgICAgICAgICAgIC8vIEZvciB3cmFwcGVkIGdyaWRzLCBkdXBsaWNhdGUgZmlyc3QgY29sdW1uIGFzIGxhc3QgY29sdW1uIHRvIHNpbXBsaWZ5IGludGVycG9sYXRpb24gbG9naWNcclxuICAgICAgICAgICAgICAgIHJvdy5wdXNoKHJvd1swXSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdGhpcy5ncmlkW2pdID0gcm93O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY2FsbGJhY2soe1xyXG4gICAgICAgICAgICBkYXRlOiB0aGlzLmRhdGUsXHJcbiAgICAgICAgICAgIGludGVycG9sYXRlOiB0aGlzLmludGVycG9sYXRlXHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBjcmVhdGVCdWlsZGVyKGRhdGEpIHtcclxuICAgICAgICBsZXQgdUNvbXAgPSBudWxsLFxyXG4gICAgICAgICAgICB2Q29tcCA9IG51bGwsXHJcbiAgICAgICAgICAgIHNjYWxhciA9IG51bGw7XHJcblxyXG4gICAgICAgIGRhdGEuZm9yRWFjaCgocmVjb3JkKSA9PiB7XHJcbiAgICAgICAgICAgIHN3aXRjaCAocmVjb3JkLmhlYWRlci5wYXJhbWV0ZXJDYXRlZ29yeSArIFwiLFwiICsgcmVjb3JkLmhlYWRlci5wYXJhbWV0ZXJOdW1iZXIpIHtcclxuICAgICAgICAgICAgICAgIGNhc2UgXCIxLDJcIjpcclxuICAgICAgICAgICAgICAgIGNhc2UgXCIyLDJcIjpcclxuICAgICAgICAgICAgICAgICAgICB1Q29tcCA9IHJlY29yZDtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIGNhc2UgXCIxLDNcIjpcclxuICAgICAgICAgICAgICAgIGNhc2UgXCIyLDNcIjpcclxuICAgICAgICAgICAgICAgICAgICB2Q29tcCA9IHJlY29yZDtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICAgICAgc2NhbGFyID0gcmVjb3JkO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzLmNyZWF0ZVdpbmRCdWlsZGVyKHVDb21wLCB2Q29tcCk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBjcmVhdGVXaW5kQnVpbGRlcih1Q29tcCwgdkNvbXApIHtcclxuICAgICAgICBsZXQgdURhdGEgPSB1Q29tcC5kYXRhLFxyXG4gICAgICAgICAgICB2RGF0YSA9IHZDb21wLmRhdGE7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgaGVhZGVyOiB1Q29tcC5oZWFkZXIsICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGRhdGE6IGZ1bmN0aW9uIGRhdGEoaSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIFt1RGF0YVtpXSwgdkRhdGFbaV1dO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBpbnRlcnBvbGF0ZTogdGhpcy5iaWxpbmVhckludGVycG9sYXRlVmVjdG9yXHJcbiAgICAgICAgfTtcclxuICAgIH1cclxuXHJcblxyXG4gICAgcHJpdmF0ZSBidWlsZEJvdW5kcyhib3VuZHMsIHdpZHRoLCBoZWlnaHQpIHtcclxuICAgICAgICBsZXQgdXBwZXJMZWZ0ID0gYm91bmRzWzBdO1xyXG4gICAgICAgIGxldCBsb3dlclJpZ2h0ID0gYm91bmRzWzFdO1xyXG4gICAgICAgIGxldCB4ID0gTWF0aC5yb3VuZCh1cHBlckxlZnRbMF0pOyBcclxuICAgICAgICBsZXQgeSA9IE1hdGgubWF4KE1hdGguZmxvb3IodXBwZXJMZWZ0WzFdKSwgMCk7XHJcbiAgICAgICAgbGV0IHhNYXggPSBNYXRoLm1pbihNYXRoLmNlaWwobG93ZXJSaWdodFswXSksIHdpZHRoIC0gMSk7XHJcbiAgICAgICAgbGV0IHlNYXggPSBNYXRoLm1pbihNYXRoLmNlaWwobG93ZXJSaWdodFsxXSksIGhlaWdodCAtIDEpO1xyXG4gICAgICAgIHJldHVybiB7IHg6IHgsIHk6IHksIHhNYXg6IHdpZHRoLCB5TWF4OiB5TWF4LCB3aWR0aDogd2lkdGgsIGhlaWdodDogaGVpZ2h0IH07XHJcbiAgICB9XHJcblxyXG5cclxuICAgIC8vIGludGVycG9sYXRpb24gZm9yIHZlY3RvcnMgbGlrZSB3aW5kICh1LHYsbSlcclxuICAgIHByaXZhdGUgYmlsaW5lYXJJbnRlcnBvbGF0ZVZlY3Rvcih4LCB5LCBnMDAsIGcxMCwgZzAxLCBnMTEpIHtcclxuICAgICAgICBsZXQgcnggPSAxIC0geDtcclxuICAgICAgICBsZXQgcnkgPSAxIC0geTtcclxuICAgICAgICBsZXQgYSA9IHJ4ICogcnksXHJcbiAgICAgICAgICAgIGIgPSB4ICogcnksXHJcbiAgICAgICAgICAgIGMgPSByeCAqIHksXHJcbiAgICAgICAgICAgIGQgPSB4ICogeTtcclxuICAgICAgICBsZXQgdSA9IGcwMFswXSAqIGEgKyBnMTBbMF0gKiBiICsgZzAxWzBdICogYyArIGcxMVswXSAqIGQ7XHJcbiAgICAgICAgbGV0IHYgPSBnMDBbMV0gKiBhICsgZzEwWzFdICogYiArIGcwMVsxXSAqIGMgKyBnMTFbMV0gKiBkO1xyXG4gICAgICAgIHJldHVybiBbdSwgdiwgTWF0aC5zcXJ0KHUgKiB1ICsgdiAqIHYpXTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGRlZzJyYWQoZGVnKSB7XHJcbiAgICAgICAgcmV0dXJuIGRlZyAvIDE4MCAqIE1hdGguUEk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSByYWQyZGVnKGFuZykge1xyXG4gICAgICAgIHJldHVybiBhbmcgLyAoTWF0aC5QSSAvIDE4MC4wKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICogQHJldHVybnMge0Jvb2xlYW59IHRydWUgaWYgdGhlIHNwZWNpZmllZCB2YWx1ZSBpcyBub3QgbnVsbCBhbmQgbm90IHVuZGVmaW5lZC5cclxuICAgICovXHJcbiAgICBwcml2YXRlIGlzVmFsdWUoeCkge1xyXG4gICAgICAgIHJldHVybiB4ICE9PSBudWxsICYmIHggIT09IHVuZGVmaW5lZDtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICogQHJldHVybnMge051bWJlcn0gcmV0dXJucyByZW1haW5kZXIgb2YgZmxvb3JlZCBkaXZpc2lvbiwgaS5lLiwgZmxvb3IoYSAvIG4pLiBVc2VmdWwgZm9yIGNvbnNpc3RlbnQgbW9kdWxvXHJcbiAgICAqICAgICAgICAgIG9mIG5lZ2F0aXZlIG51bWJlcnMuIFNlZSBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL01vZHVsb19vcGVyYXRpb24uXHJcbiAgICAqL1xyXG4gICAgcHJpdmF0ZSBmbG9vck1vZChhLCBuKSB7XHJcbiAgICAgICAgcmV0dXJuIGEgLSBuICogTWF0aC5mbG9vcihhIC8gbik7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAqIEByZXR1cm5zIHtOdW1iZXJ9IHRoZSB2YWx1ZSB4IGNsYW1wZWQgdG8gdGhlIHJhbmdlIFtsb3csIGhpZ2hdLlxyXG4gICAgKi9cclxuICAgIHByaXZhdGUgY2xhbXAoeCwgcmFuZ2UpIHtcclxuICAgICAgICByZXR1cm4gTWF0aC5tYXgocmFuZ2VbMF0sIE1hdGgubWluKHgsIHJhbmdlWzFdKSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAqIEByZXR1cm5zIHtCb29sZWFufSB0cnVlIGlmIGFnZW50IGlzIHByb2JhYmx5IGEgbW9iaWxlIGRldmljZS4gRG9uJ3QgcmVhbGx5IGNhcmUgaWYgdGhpcyBpcyBhY2N1cmF0ZS5cclxuICAgICovXHJcbiAgICBwcml2YXRlIGlzTW9iaWxlKCkge1xyXG4gICAgICAgIHJldHVybiAoL2FuZHJvaWR8YmxhY2tiZXJyeXxpZW1vYmlsZXxpcGFkfGlwaG9uZXxpcG9kfG9wZXJhIG1pbml8d2Vib3MvaS50ZXN0KG5hdmlnYXRvci51c2VyQWdlbnQpKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICogQ2FsY3VsYXRlIGRpc3RvcnRpb24gb2YgdGhlIHdpbmQgdmVjdG9yIGNhdXNlZCBieSB0aGUgc2hhcGUgb2YgdGhlIHByb2plY3Rpb24gYXQgcG9pbnQgKHgsIHkpLiBUaGUgd2luZFxyXG4gICAgKiB2ZWN0b3IgaXMgbW9kaWZpZWQgaW4gcGxhY2UgYW5kIHJldHVybmVkIGJ5IHRoaXMgZnVuY3Rpb24uXHJcbiAgICAqL1xyXG4gICAgcHJpdmF0ZSBkaXN0b3J0KHByb2plY3Rpb24sIM67LCDPhiwgeCwgeSwgc2NhbGUsIHdpbmQsIHdpbmR5KSB7XHJcbiAgICAgICAgdmFyIHUgPSB3aW5kWzBdICogc2NhbGU7XHJcbiAgICAgICAgdmFyIHYgPSB3aW5kWzFdICogc2NhbGU7XHJcbiAgICAgICAgdmFyIGQgPSB0aGlzLmRpc3RvcnRpb24ocHJvamVjdGlvbiwgzrssIM+GLCB4LCB5LCB3aW5keSk7XHJcblxyXG4gICAgICAgIC8vIFNjYWxlIGRpc3RvcnRpb24gdmVjdG9ycyBieSB1IGFuZCB2LCB0aGVuIGFkZC5cclxuICAgICAgICB3aW5kWzBdID0gZFswXSAqIHUgKyBkWzJdICogdjtcclxuICAgICAgICB3aW5kWzFdID0gZFsxXSAqIHUgKyBkWzNdICogdjtcclxuICAgICAgICByZXR1cm4gd2luZDtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGRpc3RvcnRpb24ocHJvamVjdGlvbiwgzrssIM+GLCB4LCB5LCB3aW5keSkge1xyXG4gICAgICAgIGxldCDPhCA9IDIgKiBNYXRoLlBJO1xyXG4gICAgICAgIGxldCBIID0gTWF0aC5wb3coMTAsIC01LjIpO1xyXG4gICAgICAgIGxldCBozrsgPSDOuyA8IDAgPyBIIDogLUg7XHJcbiAgICAgICAgbGV0IGjPhiA9IM+GIDwgMCA/IEggOiAtSDtcclxuXHJcbiAgICAgICAgbGV0IHDOuyA9IHRoaXMucHJvamVjdCjPhiwgzrsgKyBozrssIHdpbmR5KTtcclxuICAgICAgICBsZXQgcM+GID0gdGhpcy5wcm9qZWN0KM+GICsgaM+GLCDOuywgd2luZHkpO1xyXG5cclxuICAgICAgICAvLyBNZXJpZGlhbiBzY2FsZSBmYWN0b3IgKHNlZSBTbnlkZXIsIGVxdWF0aW9uIDQtMyksIHdoZXJlIFIgPSAxLiBUaGlzIGhhbmRsZXMgaXNzdWUgd2hlcmUgbGVuZ3RoIG9mIDHCuiDOu1xyXG4gICAgICAgIC8vIGNoYW5nZXMgZGVwZW5kaW5nIG9uIM+GLiBXaXRob3V0IHRoaXMsIHRoZXJlIGlzIGEgcGluY2hpbmcgZWZmZWN0IGF0IHRoZSBwb2xlcy5cclxuICAgICAgICBsZXQgayA9IE1hdGguY29zKM+GIC8gMzYwICogz4QpO1xyXG4gICAgICAgIHJldHVybiBbKHDOu1swXSAtIHgpIC8gaM67IC8gaywgKHDOu1sxXSAtIHkpIC8gaM67IC8gaywgKHDPhlswXSAtIHgpIC8gaM+GLCAocM+GWzFdIC0geSkgLyBoz4ZdO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgbWVyY1kobGF0KSB7XHJcbiAgICAgICAgcmV0dXJuIE1hdGgubG9nKE1hdGgudGFuKGxhdCAvIDIgKyBNYXRoLlBJIC8gNCkpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgcHJvamVjdChsYXQsIGxvbiwgd2luZHkpIHtcclxuICAgICAgICAvLyBib3RoIGluIHJhZGlhbnMsIHVzZSBkZWcycmFkIGlmIG5lY2Nlc3NhcnlcclxuICAgICAgICBsZXQgeW1pbiA9IHRoaXMubWVyY1kod2luZHkuc291dGgpO1xyXG4gICAgICAgIGxldCB5bWF4ID0gdGhpcy5tZXJjWSh3aW5keS5ub3J0aCk7XHJcbiAgICAgICAgbGV0IHhGYWN0b3IgPSB3aW5keS53aWR0aCAvICh3aW5keS5lYXN0IC0gd2luZHkud2VzdCk7XHJcbiAgICAgICAgbGV0IHlGYWN0b3IgPSB3aW5keS5oZWlnaHQgLyAoeW1heCAtIHltaW4pO1xyXG5cclxuICAgICAgICBsZXQgeSA9IHRoaXMubWVyY1kodGhpcy5kZWcycmFkKGxhdCkpO1xyXG4gICAgICAgIGxldCB4ID0gKHRoaXMuZGVnMnJhZChsb24pIC0gd2luZHkud2VzdCkgKiB4RmFjdG9yO1xyXG4gICAgICAgIHkgPSAoeW1heCAtIHkpICogeUZhY3RvcjsgLy8geSBwb2ludHMgc291dGhcclxuICAgICAgICByZXR1cm4gW3gsIHldO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgaW52ZXJ0KHgsIHksIHdpbmR5KSB7XHJcbiAgICAgICAgbGV0IG1hcExvbkRlbHRhID0gd2luZHkuZWFzdCAtIHdpbmR5Lndlc3Q7XHJcbiAgICAgICAgbGV0IHdvcmxkTWFwUmFkaXVzID0gd2luZHkud2lkdGggLyB0aGlzLnJhZDJkZWcobWFwTG9uRGVsdGEpICogMzYwIC8gKDIgKiBNYXRoLlBJKTtcclxuICAgICAgICBsZXQgbWFwT2Zmc2V0WSA9IHdvcmxkTWFwUmFkaXVzIC8gMiAqIE1hdGgubG9nKCgxICsgTWF0aC5zaW4od2luZHkuc291dGgpKSAvICgxIC0gTWF0aC5zaW4od2luZHkuc291dGgpKSk7XHJcbiAgICAgICAgbGV0IGVxdWF0b3JZID0gd2luZHkuaGVpZ2h0ICsgbWFwT2Zmc2V0WTtcclxuICAgICAgICBsZXQgYSA9IChlcXVhdG9yWSAtIHkpIC8gd29ybGRNYXBSYWRpdXM7XHJcblxyXG4gICAgICAgIGxldCBsYXQgPSAxODAgLyBNYXRoLlBJICogKDIgKiBNYXRoLmF0YW4oTWF0aC5leHAoYSkpIC0gTWF0aC5QSSAvIDIpO1xyXG4gICAgICAgIGxldCBsb24gPSB0aGlzLnJhZDJkZWcod2luZHkud2VzdCkgKyB4IC8gd2luZHkud2lkdGggKiB0aGlzLnJhZDJkZWcobWFwTG9uRGVsdGEpO1xyXG4gICAgICAgIHJldHVybiBbbG9uLCBsYXRdO1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICBwcml2YXRlIGludGVycG9sYXRlRmllbGQoZ3JpZCwgYm91bmRzLCBleHRlbnQsIGNhbGxiYWNrKSB7XHJcblxyXG4gICAgICAgIGxldCBwcm9qZWN0aW9uID0ge307XHJcbiAgICAgICAgbGV0IG1hcEFyZWEgPSAoZXh0ZW50LnNvdXRoIC0gZXh0ZW50Lm5vcnRoKSAqIChleHRlbnQud2VzdCAtIGV4dGVudC5lYXN0KTtcclxuICAgICAgICBsZXQgdmVsb2NpdHlTY2FsZSA9IHRoaXMuVkVMT0NJVFlfU0NBTEUgKiBNYXRoLnBvdyhtYXBBcmVhLCAwLjQpO1xyXG5cclxuICAgICAgICBsZXQgY29sdW1ucyA9IFtdO1xyXG4gICAgICAgIGxldCB4ID0gYm91bmRzLng7XHJcblxyXG4gICAgICAgIGxldCBpbnRlcnBvbGF0ZUNvbHVtbiA9ICh4KSA9PiB7XHJcbiAgICAgICAgICAgIGxldCBjb2x1bW4gPSBbXTtcclxuICAgICAgICAgICAgZm9yIChsZXQgeSA9IGJvdW5kcy55OyB5IDw9IGJvdW5kcy55TWF4OyB5ICs9IDIpIHtcclxuICAgICAgICAgICAgICAgIGxldCBjb29yZCA9IHRoaXMuaW52ZXJ0KHgsIHksIGV4dGVudCk7XHJcbiAgICAgICAgICAgICAgICBpZiAoY29vcmQpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgzrsgPSBjb29yZFswXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgz4YgPSBjb29yZFsxXTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoaXNGaW5pdGUozrspKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vbGV0IHdpbmQgPSBncmlkLmludGVycG9sYXRlKM67LCDPhik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCB3aW5kID0gdGhpcy5pbnRlcnBvbGF0ZSjOuywgz4YpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAod2luZCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgd2luZCA9IHRoaXMuZGlzdG9ydChwcm9qZWN0aW9uLCDOuywgz4YsIHgsIHksIHZlbG9jaXR5U2NhbGUsIHdpbmQsIGV4dGVudCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2x1bW5beSArIDFdID0gY29sdW1uW3ldID0gd2luZDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBjb2x1bW5zW3ggKyAxXSA9IGNvbHVtbnNbeF0gPSBjb2x1bW47XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgbGV0IGJhdGNoSW50ZXJwb2xhdGUgPSAoKSA9PiB7XHJcbiAgICAgICAgICAgIGxldCBzdGFydCA9IERhdGUubm93KCk7XHJcbiAgICAgICAgICAgIHdoaWxlICh4IDwgYm91bmRzLndpZHRoKSB7XHJcbiAgICAgICAgICAgICAgICBpbnRlcnBvbGF0ZUNvbHVtbih4KTtcclxuICAgICAgICAgICAgICAgIHggKz0gMjtcclxuICAgICAgICAgICAgICAgIGlmIChEYXRlLm5vdygpIC0gc3RhcnQgPiAxMDAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy9NQVhfVEFTS19USU1FKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiBiYXRjaEludGVycG9sYXRlLCAyNSk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHRoaXMuY3JlYXRlRmllbGQoY29sdW1ucywgYm91bmRzLCBjYWxsYmFjayk7XHJcbiAgICAgICAgfTtcclxuICAgICAgICBiYXRjaEludGVycG9sYXRlKCk7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIHByaXZhdGUgY3JlYXRlRmllbGQoY29sdW1ucywgYm91bmRzLCBjYWxsYmFjaykge1xyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAqIEByZXR1cm5zIHtBcnJheX0gd2luZCB2ZWN0b3IgW3UsIHYsIG1hZ25pdHVkZV0gYXQgdGhlIHBvaW50ICh4LCB5KSwgb3IgW05hTiwgTmFOLCBudWxsXSBpZiB3aW5kXHJcbiAgICAgICAgKiAgICAgICAgICBpcyB1bmRlZmluZWQgYXQgdGhhdCBwb2ludC5cclxuICAgICAgICAqL1xyXG4gICAgICAgIGxldCBmaWVsZDogYW55ID0gKHgsIHkpID0+IHtcclxuICAgICAgICAgICAgdmFyIGNvbHVtbiA9IGNvbHVtbnNbTWF0aC5yb3VuZCh4KV07XHJcbiAgICAgICAgICAgIHJldHVybiBjb2x1bW4gJiYgY29sdW1uW01hdGgucm91bmQoeSldIHx8IHRoaXMuTlVMTF9XSU5EX1ZFQ1RPUjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIEZyZWVzIHRoZSBtYXNzaXZlIFwiY29sdW1uc1wiIGFycmF5IGZvciBHQy4gV2l0aG91dCB0aGlzLCB0aGUgYXJyYXkgaXMgbGVha2VkIChpbiBDaHJvbWUpIGVhY2ggdGltZSBhIG5ld1xyXG4gICAgICAgIC8vIGZpZWxkIGlzIGludGVycG9sYXRlZCBiZWNhdXNlIHRoZSBmaWVsZCBjbG9zdXJlJ3MgY29udGV4dCBpcyBsZWFrZWQsIGZvciByZWFzb25zIHRoYXQgZGVmeSBleHBsYW5hdGlvbi5cclxuICAgICAgICBmaWVsZC5yZWxlYXNlID0gKCkgPT4ge1xyXG4gICAgICAgICAgICBjb2x1bW5zID0gW107XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgZmllbGQucmFuZG9taXplID0gKG8pID0+IHtcclxuICAgICAgICAgICAgLy8gVU5ET05FOiB0aGlzIG1ldGhvZCBpcyB0ZXJyaWJsZVxyXG4gICAgICAgICAgICB2YXIgeCwgeTtcclxuICAgICAgICAgICAgdmFyIHNhZmV0eU5ldCA9IDA7XHJcbiAgICAgICAgICAgIGRvIHtcclxuICAgICAgICAgICAgICAgIHggPSBNYXRoLnJvdW5kKE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIGJvdW5kcy53aWR0aCkgKyBib3VuZHMueCk7XHJcbiAgICAgICAgICAgICAgICB5ID0gTWF0aC5yb3VuZChNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBib3VuZHMuaGVpZ2h0KSArIGJvdW5kcy55KTtcclxuICAgICAgICAgICAgfSB3aGlsZSAoZmllbGQoeCwgeSlbMl0gPT09IG51bGwgJiYgc2FmZXR5TmV0KysgPCAzMCk7XHJcbiAgICAgICAgICAgIG8ueCA9IHg7XHJcbiAgICAgICAgICAgIG8ueSA9IHk7XHJcbiAgICAgICAgICAgIHJldHVybiBvO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGNhbGxiYWNrKGJvdW5kcywgZmllbGQpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYW5pbWF0ZShib3VuZHMsIGZpZWxkKSB7XHJcblxyXG4gICAgICAgIGxldCB3aW5kSW50ZW5zaXR5Q29sb3JTY2FsZSA9IChtaW4sIG1heCkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLmNvbG9yU2NhbGUuaW5kZXhGb3IgPSAobSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgLy8gbWFwIHZlbG9jaXR5IHNwZWVkIHRvIGEgc3R5bGVcclxuICAgICAgICAgICAgICAgIHJldHVybiBNYXRoLm1heCgwLCBNYXRoLm1pbih0aGlzLmNvbG9yU2NhbGUubGVuZ3RoIC0gMSwgTWF0aC5yb3VuZCgobSAtIG1pbikgLyAobWF4IC0gbWluKSAqICh0aGlzLmNvbG9yU2NhbGUubGVuZ3RoIC0gMSkpKSk7XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNvbG9yU2NhbGU7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgY29sb3JTdHlsZXMgPSB3aW5kSW50ZW5zaXR5Q29sb3JTY2FsZSh0aGlzLk1JTl9WRUxPQ0lUWV9JTlRFTlNJVFksIHRoaXMuTUFYX1ZFTE9DSVRZX0lOVEVOU0lUWSk7XHJcbiAgICAgICAgbGV0IGJ1Y2tldHMgPSBjb2xvclN0eWxlcy5tYXAoZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gW107XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGxldCBwYXJ0aWNsZUNvdW50ID0gTWF0aC5yb3VuZChib3VuZHMud2lkdGggKiBib3VuZHMuaGVpZ2h0ICogdGhpcy5QQVJUSUNMRV9NVUxUSVBMSUVSKTtcclxuICAgICAgICBpZiAodGhpcy5pc01vYmlsZSgpKSB7XHJcbiAgICAgICAgICAgIHBhcnRpY2xlQ291bnQgKj0gdGhpcy5QQVJUSUNMRV9SRURVQ1RJT047XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgZmFkZUZpbGxTdHlsZSA9IFwicmdiYSgwLCAwLCAwLCAwLjk3KVwiO1xyXG5cclxuICAgICAgICBsZXQgcGFydGljbGVzID0gW107XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXJ0aWNsZUNvdW50OyBpKyspIHtcclxuICAgICAgICAgICAgcGFydGljbGVzLnB1c2goZmllbGQucmFuZG9taXplKHsgYWdlOiBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiB0aGlzLk1BWF9QQVJUSUNMRV9BR0UpICsgMCB9KSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgZXZvbHZlID0gKCkgPT4ge1xyXG4gICAgICAgICAgICBidWNrZXRzLmZvckVhY2goKGJ1Y2tldCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgYnVja2V0Lmxlbmd0aCA9IDA7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBwYXJ0aWNsZXMuZm9yRWFjaCgocGFydGljbGUpID0+IHtcclxuICAgICAgICAgICAgICAgIGlmIChwYXJ0aWNsZS5hZ2UgPiB0aGlzLk1BWF9QQVJUSUNMRV9BR0UpIHtcclxuICAgICAgICAgICAgICAgICAgICBmaWVsZC5yYW5kb21pemUocGFydGljbGUpLmFnZSA9IDA7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB2YXIgeCA9IHBhcnRpY2xlLng7XHJcbiAgICAgICAgICAgICAgICB2YXIgeSA9IHBhcnRpY2xlLnk7XHJcbiAgICAgICAgICAgICAgICB2YXIgdiA9IGZpZWxkKHgsIHkpOyAvLyB2ZWN0b3IgYXQgY3VycmVudCBwb3NpdGlvblxyXG4gICAgICAgICAgICAgICAgdmFyIG0gPSB2WzJdO1xyXG4gICAgICAgICAgICAgICAgaWYgKG0gPT09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgICAgICBwYXJ0aWNsZS5hZ2UgPSB0aGlzLk1BWF9QQVJUSUNMRV9BR0U7IC8vIHBhcnRpY2xlIGhhcyBlc2NhcGVkIHRoZSBncmlkLCBuZXZlciB0byByZXR1cm4uLi5cclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHh0ID0geCArIHZbMF07XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHl0ID0geSArIHZbMV07XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZpZWxkKHh0LCB5dClbMl0gIT09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gUGF0aCBmcm9tICh4LHkpIHRvICh4dCx5dCkgaXMgdmlzaWJsZSwgc28gYWRkIHRoaXMgcGFydGljbGUgdG8gdGhlIGFwcHJvcHJpYXRlIGRyYXcgYnVja2V0LlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJ0aWNsZS54dCA9IHh0O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJ0aWNsZS55dCA9IHl0O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBidWNrZXRzW2NvbG9yU3R5bGVzLmluZGV4Rm9yKG0pXS5wdXNoKHBhcnRpY2xlKTtcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBQYXJ0aWNsZSBpc24ndCB2aXNpYmxlLCBidXQgaXQgc3RpbGwgbW92ZXMgdGhyb3VnaCB0aGUgZmllbGQuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcnRpY2xlLnggPSB4dDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcGFydGljbGUueSA9IHl0O1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHBhcnRpY2xlLmFnZSArPSAxO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCBnID0gdGhpcy5jYW52YXMuZ2V0Q29udGV4dChcIjJkXCIpO1xyXG4gICAgICAgIGcubGluZVdpZHRoID0gdGhpcy5QQVJUSUNMRV9MSU5FX1dJRFRIO1xyXG4gICAgICAgIGcuZmlsbFN0eWxlID0gZmFkZUZpbGxTdHlsZTtcclxuICAgICAgICBnLmdsb2JhbEFscGhhID0gMC42O1xyXG5cclxuICAgICAgICBsZXQgZHJhdyA9ICgpID0+IHtcclxuICAgICAgICAgICAgLy8gRmFkZSBleGlzdGluZyBwYXJ0aWNsZSB0cmFpbHMuXHJcbiAgICAgICAgICAgIGxldCBwcmV2ID0gXCJsaWdodGVyXCI7XHJcbiAgICAgICAgICAgIGcuZ2xvYmFsQ29tcG9zaXRlT3BlcmF0aW9uID0gXCJkZXN0aW5hdGlvbi1pblwiO1xyXG4gICAgICAgICAgICBnLmZpbGxSZWN0KGJvdW5kcy54LCBib3VuZHMueSwgYm91bmRzLndpZHRoLCBib3VuZHMuaGVpZ2h0KTtcclxuICAgICAgICAgICAgZy5nbG9iYWxDb21wb3NpdGVPcGVyYXRpb24gPSBwcmV2O1xyXG4gICAgICAgICAgICBnLmdsb2JhbEFscGhhID0gMC45O1xyXG5cclxuICAgICAgICAgICAgLy8gRHJhdyBuZXcgcGFydGljbGUgdHJhaWxzLlxyXG4gICAgICAgICAgICBidWNrZXRzLmZvckVhY2goKGJ1Y2tldCwgaSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgaWYgKGJ1Y2tldC5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZy5iZWdpblBhdGgoKTtcclxuICAgICAgICAgICAgICAgICAgICBnLnN0cm9rZVN0eWxlID0gY29sb3JTdHlsZXNbaV07XHJcbiAgICAgICAgICAgICAgICAgICAgYnVja2V0LmZvckVhY2goKHBhcnRpY2xlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGcubW92ZVRvKHBhcnRpY2xlLngsIHBhcnRpY2xlLnkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBnLmxpbmVUbyhwYXJ0aWNsZS54dCwgcGFydGljbGUueXQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJ0aWNsZS54ID0gcGFydGljbGUueHQ7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcnRpY2xlLnkgPSBwYXJ0aWNsZS55dDtcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICBnLnN0cm9rZSgpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCB0aGVuID0gRGF0ZS5ub3coKTtcclxuICAgICAgICBsZXQgZnJhbWUgPSAoKSA9PiB7XHJcbiAgICAgICAgICAgIFdpbmR5LmFuaW1hdGlvbkxvb3AgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoZnJhbWUpO1xyXG4gICAgICAgICAgICB2YXIgbm93ID0gRGF0ZS5ub3coKTtcclxuICAgICAgICAgICAgdmFyIGRlbHRhID0gbm93IC0gdGhlbjtcclxuICAgICAgICAgICAgaWYgKGRlbHRhID4gdGhpcy5GUkFNRV9USU1FKSB7XHJcbiAgICAgICAgICAgICAgICB0aGVuID0gbm93IC0gZGVsdGEgJSB0aGlzLkZSQU1FX1RJTUU7XHJcbiAgICAgICAgICAgICAgICBldm9sdmUoKTtcclxuICAgICAgICAgICAgICAgIGRyYXcoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcbiAgICAgICAgZnJhbWUoKTtcclxuICAgIH1cclxufVxyXG5cclxuaWYgKCF3aW5kb3cuY2FuY2VsQW5pbWF0aW9uRnJhbWUpIHtcclxuICAgIHdpbmRvdy5jYW5jZWxBbmltYXRpb25GcmFtZSA9IChpZCkgPT4ge1xyXG4gICAgICAgIGNsZWFyVGltZW91dChpZCk7XHJcbiAgICB9O1xyXG59Il19
