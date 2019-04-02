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

// The above copyright notice and this permission notice shall be included 
// in all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS 
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL 
// THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, 
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN 
// THE SOFTWARE.
///////////////////////////////////////////////////////////////////////////

import * as MapView from "esri/views/MapView";
import * as SceneView from "esri/views/SceneView";
import * as GraphicsLayer from "esri/layers/GraphicsLayer";
import * as esriRequest from "esri/request";
import * as Extent from "esri/geometry/Extent";
import * as webMercatorUtils from "esri/geometry/support/webMercatorUtils";
import * as watchUtils from "esri/core/watchUtils";
import * as Point from "esri/geometry/Point";
import * as asd from "esri/core/accessorSupport/decorators";


import BaseLayerView2D = require("esri/views/2d/layers/BaseLayerView2D");


export type CustomFadeFunction = (context: CanvasRenderingContext2D, bounds: Bounds) => void;
export type CustomDrawFunction = (context: CanvasRenderingContext2D, particles: Particle, colorStyle: string) => void;

export interface DensityStop {
    zoom: number;
    density: number;
}

/** 
    The available display options to change the particle rendering
*/
export interface DisplayOptions {

    /**
     * Minimum velcity that will applied to a particle
     * default: 0
     * */
    minVelocity?: number;

    /**
     * Maimum velocity that will be applied to a particle
     * default: 10
     * */
    maxVelocity?: number;

    /**
     * Determines how quickly the particle moves based on it's velocity. Higher values mean faster moving.
     * default: 0.005
     * */
    velocityScale?: number;

    /**
     * The number of frames a particle will live for.
     * default: 90
     * */
    particleAge?: number;


    /**
     * The number of particles per 50x50 pixel block. If a number that density is applied across the board. If an array of density stops decalre the zoom level and density that would you like to apply.
     * start with higher zoom first eg: [{ zoom: 2, density: 10 }, { zoom: 5, density: 8 }, {zoom: 6, density: 7}]
     * the first being the zoom and 
     * default: 10
     * */
    particleDensity?: number | DensityStop[];


    /**
     * The frame rate to use when animating. If the velocityScale parameter is higher then this will need to be increased to keep up with the required frames to draw the particles at a quicker speed. 
     * If it's not a high enough value the animations could appear jumpy.
     * default: 15
     * */
    frameRate?: number;

    /**
     * An array of color values to use. Velocity values will be ampped o this color scale.
     * default: ["rgb(61,160,247)", "rgb(99,164,217)", "rgb(138,168,188)", "rgb(177,173,158)", "rgb(216,177,129)", "rgb(255,182,100)", "rgb(240,145,87)", "rgb(225,109,74)", "rgb(210,72,61)", "rgb(195,36,48)", "rgb(180,0,35)"];
     * */
    colorScale?: string[];

    /**
     * the width of the line for default rendering.
     * default: 1
     * */
    lineWidth?: number;

    /**
     * An amount to reduce particle numbers by on mobile devices
     * default: (Math.pow(window.devicePixelRatio, 1 / 3) || 1.6)
     * */
    particleReduction?: number;

    /** 
     * A function that if exists will be called in the draw method that allows specific settings for a layer to be applied for the fading out part of the drawing. 
     * */
    customFadeFunction?: CustomFadeFunction; 

    /**
     * A function that if exists will be called to draw the particles. Allows for caller to have complete control over drawing. Will pass the context, particle object and the color style. 
     * */
    customDrawFunction?: CustomDrawFunction;
}


/**
    An simple object to define dynamic particle multipliers depending on current zoom level.
    A basic attempt to cater for particles displaying too densely on close in zoom levels.
*/
export interface ParticleMultiplierByZoom {
    // the base zoom level to start calculating at. Find a pariticle multipler at this zoom level that looks good for your data.
    zoomLevel: number,

    // The particle multiplier for the base zoom level specified above. Find a particle multipler at this zoom level that looks good for your data.
    particleMultiplier: number,

    // The amount to subtract or add to the particle multiplier depending on zoom level
    diffRatio: number,

    // the min value the multiplier can go
    minMultiplier: number,

    // the max value the multiplier can go
    maxMultiplier: number
}


/**
 The return object from the point-report event
*/
export interface PointReport {
    point: Point;
    target: AnimatedEnvironmentLayer;
    degree?: number;
    velocity?: number;
}

export interface AnimatedEnvironmentLayerProperties extends __esri.GraphicsLayerProperties {
    activeView?: MapView | SceneView;
    url?: string;
    displayOptions?: DisplayOptions;
    reportValues?: boolean;
}

export interface Bounds {
    x: number;
    y: number;
    width: number;
    height: number;
    xMax: number;
    yMax: number;
}

export interface Particle {
    x?: number;
    y?: number;
    xt?: number;
    yt?: number;
    age?: number;
    currentVector?: number[];
}


class AnimatedEnvironmentLayerView2D extends BaseLayerView2D {

    layer: AnimatedEnvironmentLayer;
    private viewState: __esri.ViewState;
    private context: CanvasRenderingContext2D;

    private drawing: boolean;
    private drawPrepping: boolean;
    private drawReady: boolean;

    private southWest: Point;
    private northEast: Point;

    windy: Windy;
    date: Date;

    constructor(props) {
        super();
        this.view = props.view;
        this.layer = <AnimatedEnvironmentLayer>props.layer;

        this.view.on("resize", () => {
            if (!this.context) return;

            // resize the canvas
            this.context.canvas.width = this.view.width;
            this.context.canvas.height = this.view.height;
        });


        watchUtils.watch(this.layer, "visible", (nv, olv, pn, ta) => {
            if (!nv) {
                this.clear();
            }
            else {
                this.prepDraw();
            }
        });

    }


    render(renderParameters) {

        this.viewState = renderParameters.state;

        if (!renderParameters.stationary) {
            // not stationary so clear if drawn and set to prep again
            if (this.drawing) {
                this.clear();
                this.drawing = false;
            }
            this.drawPrepping = false;
            this.drawReady = false;
            return;
        }

        if (!this.drawPrepping && !this.drawReady) { 
            // prep the draw
            this.drawPrepping = true;
            if (this.windy && this.windy.gridData) {
                this.prepDraw();
            }
            return;
        }

        if (this.drawReady) {

            if (!this.drawing) {
                // this.animationLoop(); // haven't started drawing so kick off our animation loop
                this.startWindy();
            }

            // draw the custom context into this layers context
            renderParameters.context.drawImage(this.context.canvas, 0, 0);
            this.drawing = true;

            // call request render so we copy the draw again
            this.requestRender();
        }
    }

    private startWindy() {

        setTimeout(() => {

            this.windy.start(
                [[0, 0], [this.context.canvas.width, this.context.canvas.height]],
                this.context.canvas.width,
                this.context.canvas.height,
                [[this.southWest.x, this.southWest.y], [this.northEast.x, this.northEast.y]]
            );

            this.setDate();

        }, 500);

    }

    attach() {

        // use attach to initilaize a custom canvas to draw on
        // create the canvas, set some properties. 
        let canvas = document.createElement("canvas");
        canvas.id = "ael-" + Date.now();
        canvas.style.position = "absolute";
        canvas.style.top = "0";
        canvas.style.left = "0";
        canvas.width = this.view.width;
        canvas.height = this.view.height;
        let context = canvas.getContext("2d");
        this.context = context;

        this.initWindy();
    }

    /**
     * Init the windy class 
     * @param data
     */
    private initWindy(data?) {
        this.windy = new Windy(
            this.context.canvas,
            this.layer.displayOptions,
            undefined
            );
    }


    clear(stopDraw: boolean = true) {

        if (stopDraw) {
            this.stopDraw();
        }

        if (this.context) {
            this.context.clearRect(0, 0, this.view.width, this.view.height);
        }
    }

    stopDraw() {
        this.windy.stop();
        this.drawing = false;
    }


    prepDraw(data?: any) {

        if (data) this.windy.setData(data);

        this.setParticleDensity();
        this.startDraw();
        this.drawPrepping = false;
        this.drawReady = true;
        this.requestRender();
    }
     

    private startDraw() {

        // use the extent of the view, and not the extent passed into fetchImage...it was slightly off when it crossed IDL.
        let extent = this.view.extent;
        if (extent.spatialReference.isWebMercator) {
            extent = <Extent>webMercatorUtils.webMercatorToGeographic(extent);
        }

        this.northEast = new Point({ x: extent.xmax, y: extent.ymax });
        this.southWest = new Point({ x: extent.xmin, y: extent.ymin });

        // resize the canvas
        this.context.canvas.width = this.view.width;
        this.context.canvas.height = this.view.height;

        // cater for the extent crossing the IDL
        if (this.southWest.x > this.northEast.x && this.northEast.x < 0) {
            this.northEast.x = 360 + this.northEast.x;
        }

    }


    private setParticleDensity() {
        if (!Array.isArray(this.layer.displayOptions.particleDensity)) {
            return; // not an array, so must be a number, exit out here as there's no calc to do
        }

        let stops = this.layer.displayOptions.particleDensity;
        let currentZoom = Math.round(this.view.zoom);
        let density = -1;

        let zoomMap = stops.map((stop) => {
            return stop.zoom;
        });

        // loop the zooms 

        for (let i = 0; i < stops.length; i++) {
            let stop = stops[i];

            if (stop.zoom === currentZoom) {
                density = stop.density;
                break;
            }

            let nextStop = i + 1 < stops.length ? stops[i + 1] : undefined;
            if (!nextStop) {
                // this is the last one, so just set to this value
                density = stop.density;
                break;
            }

            if (nextStop.zoom > currentZoom) {
                density = stop.density;
                break;
            }

        }

        // if density still not found, set it to the last value in the stops array
        if (density === -1) {
            density = stops[stops.length - 1].density;
        }

        this.windy.calculatedDensity = density;

    }

    private setDate() {
        if (this.windy) {
            if (this.windy.refTime && this.windy.forecastTime) {

                // assume the ref time is an iso string, or some other equivalent that javascript Date object can parse.
                let d = new Date(this.windy.refTime);

                // add the forecast time as hours to the refTime;
                d.setHours(d.getHours() + this.windy.forecastTime);
                this.date = d;
                return;
            }
        }

        this.date = undefined;
    }

}




@asd.subclass("AnimatedEnvironmentLayer")
export class AnimatedEnvironmentLayer extends asd.declared(GraphicsLayer) {

    @asd.property()
    url: string;

    @asd.property()
    displayOptions: DisplayOptions;

    @asd.property()
    reportValues: boolean;

    @asd.property()
    dataLoading: boolean;

    @asd.property()
    isErrored: boolean;

    private dataFetchRequired: boolean;
    layerView: AnimatedEnvironmentLayerView2D;

    constructor(properties: AnimatedEnvironmentLayerProperties) {
        super(properties);

        // If the active view is set in properties, then set it here.
        this.url = properties.url;
        this.displayOptions = properties.displayOptions || {};
        if (Array.isArray(this.displayOptions.particleDensity)) {

            // make sure the particle density stops array is is order by zoom level lowest zooms first
            this.displayOptions.particleDensity.sort((a, b) => {
                return a.zoom - b.zoom;
            });
        }


        this.reportValues = properties.reportValues === false ? false : true; // default to true

        // watch url prop so a fetch of data and redraw will occur.
        watchUtils.watch(this, "url", (a, b, c, d) => this._urlChanged(a, b, c, d));

        // watch visible so a fetch of data and redraw will occur.
        watchUtils.watch(this, "visible", (a, b, c, d) => this._visibleChanged(a, b, c, d));

        // watch display options so to redraw when changed.
        watchUtils.watch(this, "displayOptions", (a, b, c, d) => this._displayOptionsChanged(a, b, c, d));
        this.dataFetchRequired = true;
    }


    createLayerView(view: __esri.MapView | __esri.SceneView) {

        // only supports 2d right now.
        if (view.type !== "2d") return;

        // hook up the AnimatedEnvironmentLayerView2D as the layer view
        this.layerView = new AnimatedEnvironmentLayerView2D({
            view: view,
            layer: this
        });

        this.layerView.view.on("pointer-move", (evt) => this.viewPointerMove(evt));
        this.draw(true);
        return this.layerView;
    }

    /**
     * Start a draw
     */
    draw(forceDataRefetch?: boolean) {

        if (forceDataRefetch != null) {
            this.dataFetchRequired = forceDataRefetch;
        }

        if (!this.url || !this.visible) return; // no url set, not visible or is currently drawing, exit here.

        // if data should be fetched, go get it now.
        if (this.dataFetchRequired) {
            this.isErrored = false;
            this.dataLoading = true;

            esriRequest(this.url, {
                responseType: "json"
            })
                .then((response) => {
                    this.dataFetchRequired = false;
                    this.doDraw(response.data); // all sorted draw now.
                    this.dataLoading = false;
                })
                .otherwise((err) => {
                    console.error("Error occurred retrieving data. " + err);
                    this.dataLoading = false;
                    this.isErrored = true;
                });
        }
        else {
            // no need for data, just draw.
            this.doDraw();

        }
    }


    stop() {
        if (this.layerView) {
            this.layerView.stopDraw();
        }
    }

    start() {
        this.doDraw();
    }

    /**
     * Call the windy draw method
     */
    private doDraw(data?: any) {
        this.layerView.prepDraw(data);
    }


    private viewPointerMove(evt) {
        if (!this.layerView.windy || !this.visible) return;

        let mousePos = this._getMousePos(evt);
        let point = this.layerView.view.toMap({ x: mousePos.x, y: mousePos.y });
        if (point.spatialReference.isWebMercator) {
            point = <Point>webMercatorUtils.webMercatorToGeographic(point);
        }

        let grid = this.layerView.windy.interpolate(point.x, point.y);
        let result: PointReport = {
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

    }

    /**
     * Convert the windy vector data to meters per second
     * @param uMs
     * @param vMs
     */
    private _vectorToSpeed(uMs, vMs) {
        let speedAbs = Math.sqrt(Math.pow(uMs, 2) + Math.pow(vMs, 2));
        return speedAbs;
    }

    /**
     * Return the windy vector data as a direction. Returns the direction of the flow of the data with the degrees in a clockwise direction.
     * @param uMs
     * @param vMs
     */
    private _vectorToDegrees(uMs, vMs) {

        let abs = Math.sqrt(Math.pow(uMs, 2) + Math.pow(vMs, 2));
        let direction = Math.atan2(uMs / abs, vMs / abs);
        let directionToDegrees = direction * 180 / Math.PI + 180;

        directionToDegrees += 180;
        if (directionToDegrees >= 360) directionToDegrees -= 360;

        return directionToDegrees;
    }


    private _getMousePos(evt) {
        // container on the view is actually a html element at this point, not a string as the typings suggest.
        let container: any = this.layerView.view.container;
        let rect = container.getBoundingClientRect();
        return {
            x: evt.x - rect.left,
            y: evt.y - rect.top
        };
    }


    /**
     * Watch of the url property - call draw again with a refetch
     */
    private _urlChanged(a, b, c, d) {
        this.stop();
        this.dataFetchRequired = true;
        this.draw();
    }

    /**
     * Watch of the visible property - stop and start depending on value
     */
    private _visibleChanged(visible, b, c, d) {
        if (!visible) {
            this.stop();
        }
        else {
            this.draw();
        }

    }

    /**
     * Watch of displayOptions - call draw again with new options set on windy.
     */
    private _displayOptionsChanged(newOptions, b, c, d) {
        if (!this.layerView.windy) return;

        this.layerView.windy.stop();
        this.layerView.windy.setDisplayOptions(newOptions);
        this.draw();
    }

}



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
class Windy {

    displayOptions: DisplayOptions;
    calculatedDensity: number;

    FRAME_TIME: number;

    colorScale: any;
    canvas: HTMLCanvasElement;

    forecastTime: number;
    refTime: string;

    NULL_WIND_VECTOR = [NaN, NaN, null]; // singleton for no wind in the form: [u, v, magnitude]

    static field: any;
    static animationLoop;

    builder;
    grid;
    gridData: any;
    date;
    lo1;
    la1;
    dx;
    dy;
    ni;
    nj;

    private _scanMode: number;

    constructor(canvas: HTMLCanvasElement, options: DisplayOptions, data?: any) {

        this.canvas = canvas;
        this.setDisplayOptions(options);
        this.gridData = data;

    }

    setData(data) {
        this.gridData = data;
    }

    setDisplayOptions(options: DisplayOptions) {

        this.displayOptions = options;

        // setup some defaults
        this.displayOptions.minVelocity = this.displayOptions.minVelocity || 0;
        this.displayOptions.maxVelocity = this.displayOptions.maxVelocity || 10;
        this.displayOptions.particleDensity = this.displayOptions.particleDensity || 10;

        this.calculatedDensity = Array.isArray(this.displayOptions.particleDensity) ? 10 : this.displayOptions.particleDensity;


        this.displayOptions.velocityScale = (this.displayOptions.velocityScale || 0.005) * (Math.pow(window.devicePixelRatio, 1 / 3) || 1); // scale for velocity (completely arbitrary -- this value looks nice)
        this.displayOptions.particleAge = this.displayOptions.particleAge || 90;
        this.displayOptions.lineWidth = this.displayOptions.lineWidth || 1;
        this.displayOptions.particleReduction = this.displayOptions.particleReduction || (Math.pow(window.devicePixelRatio, 1 / 3) || 1.6); // multiply particle count for mobiles by this amount
        this.displayOptions.frameRate = this.displayOptions.frameRate || 15; 

        var defaultColorScale = ["rgb(61,160,247)", "rgb(99,164,217)", "rgb(138,168,188)", "rgb(177,173,158)", "rgb(216,177,129)", "rgb(255,182,100)", "rgb(240,145,87)", "rgb(225,109,74)", "rgb(210,72,61)", "rgb(195,36,48)", "rgb(180,0,35)"];
        this.colorScale = this.displayOptions.colorScale || defaultColorScale;

        this.FRAME_TIME = 1000 / this.displayOptions.frameRate; // desired frames per second

    }

    start(bounds, width, height, extent) {

        let mapBounds = {
            south: this.deg2rad(extent[0][1]),
            north: this.deg2rad(extent[1][1]),
            east: this.deg2rad(extent[1][0]),
            west: this.deg2rad(extent[0][0]),
            width: width,
            height: height
        };

        this.stop();

        // build grid
        this.buildGrid(this.gridData, (gridResult) => {
            let builtBounds = this.buildBounds(bounds, width, height);
            this.interpolateField(gridResult, builtBounds, mapBounds, (bounds, field) => {
                // animate the canvas with random points
                Windy.field = field;
                this.animate(bounds, Windy.field);
            });
        });
    }

    stop() {
        if (Windy.field) Windy.field.release();
        if (Windy.animationLoop) cancelAnimationFrame(Windy.animationLoop);
    }

    /**
    * Get interpolated grid value from Lon/Lat position
   * @param lon {Float} Longitude
   * @param lat {Float} Latitude
   * @returns {Object}
   */
    interpolate(lon, lat) {

        if (!this.grid) return null;

        let i = this.floorMod(lon - this.lo1, 360) / this.dx; // calculate longitude index in wrapped range [0, 360)
        let j = (this.la1 - lat) / this.dy; // calculate latitude index in direction +90 to -90

        if (this._scanMode === 64) {
            // calculate latitude index in direction -90 to +90 as this is scan mode 64
            j = (lat - this.la1) / this.dy;
            j = this.grid.length - j;
        }


        let fi = Math.floor(i),
            ci = fi + 1;
        let fj = Math.floor(j),
            cj = fj + 1;

        let row;
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
    }

    private buildGrid(data, callback) {

        this.builder = this.createBuilder(data);
        var header = this.builder.header;

        this.lo1 = header.lo1;
        this.la1 = header.la1; // the grid's origin (e.g., 0.0E, 90.0N)

        this.dx = header.dx;
        this.dy = header.dy; // distance between grid points (e.g., 2.5 deg lon, 2.5 deg lat)

        this.ni = header.nx;
        this.nj = header.ny; // number of grid points W-E and N-S (e.g., 144 x 73)

        this.date = new Date(header.refTime);
        this.date.setHours(this.date.getHours() + header.forecastTime);

        this._scanMode = header.scanMode;

        this.grid = [];
        var p = 0;
        var isContinuous = Math.floor(this.ni * this.dx) >= 360;

        if (header.scanMode === 0) {
            // Scan mode 0. Longitude increases from λ0, and latitude decreases from φ0.
            // http://www.nco.ncep.noaa.gov/pmb/docs/grib2/grib2_table3-4.shtml

            for (let j = 0; j < this.nj; j++) {
                let row = [];
                for (let i = 0; i < this.ni; i++ , p++) {
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
            for (let j = this.nj - 1; j >= 0; j--) {
                let row = [];
                for (let i = 0; i < this.ni; i++ , p++) {
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
    }

    private createBuilder(data) {
        let uComp = null,
            vComp = null,
            scalar = null,
            directionTrue = null,
            magnitude = null;

        let supported = true;
        let headerFields;

        data.forEach((record) => {
            headerFields = `${record.header.discipline},${record.header.parameterCategory},${record.header.parameterNumber}`;
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
            this.refTime = record.header.refTime;
            this.forecastTime = record.header.forecastTime;
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
            for (let i = 0, len = directionTrue.data.length; i < len; i++) {

                let dir = directionTrue.data[i];
                let mag = magnitude.data[i];

                if ((!dir || isNaN(dir)) || (!mag || isNaN(mag))) {
                    vComp[i] = null;
                    uComp[i] = null;
                    continue;
                }

                let phi = dir * Math.PI / 180;
                let u = -mag * Math.sin(phi);
                let v = -mag * Math.cos(phi);

                uComp.data[i] = u;
                vComp.data[i] = v;

            }
        }


        return this.createWindBuilder(uComp, vComp);
    }

    private createWindBuilder(uComp, vComp) {
        let uData = uComp.data,
            vData = vComp.data;
        return {
            header: uComp.header,
            data: function data(i) {
                return [uData[i], vData[i]];
            },
            interpolate: this.bilinearInterpolateVector
        };
    }


    private buildBounds(bounds, width, height) : Bounds {
        let upperLeft = bounds[0];
        let lowerRight = bounds[1];
        let x = Math.round(upperLeft[0]);
        let y = Math.max(Math.floor(upperLeft[1]), 0);
        let xMax = Math.min(Math.ceil(lowerRight[0]), width - 1);
        let yMax = Math.min(Math.ceil(lowerRight[1]), height - 1);
        return {
            x: x,
            y: y,
            xMax: xMax,
            yMax: yMax,
            width: width,
            height: height
        };
    }


    // interpolation for vectors like wind (u,v,m)
    private bilinearInterpolateVector(x, y, g00, g10, g01, g11) {
        let rx = 1 - x;
        let ry = 1 - y;
        let a = rx * ry,
            b = x * ry,
            c = rx * y,
            d = x * y;
        let u = g00[0] * a + g10[0] * b + g01[0] * c + g11[0] * d;
        let v = g00[1] * a + g10[1] * b + g01[1] * c + g11[1] * d;
        return [u, v, Math.sqrt(u * u + v * v)];
    }

    private deg2rad(deg) {
        return deg / 180 * Math.PI;
    }

    private rad2deg(ang) {
        return ang / (Math.PI / 180.0);
    }

    /**
    * @returns {Boolean} true if the specified value is not null and not undefined.
    */
    private isValue(x) {
        return x !== null && x !== undefined;
    }

    /**
    * @returns {Number} returns remainder of floored division, i.e., floor(a / n). Useful for consistent modulo
    *          of negative numbers. See http://en.wikipedia.org/wiki/Modulo_operation.
    */
    private floorMod(a, n) {
        return a - n * Math.floor(a / n);
    }

    /**
    * @returns {Number} the value x clamped to the range [low, high].
    */
    private clamp(x, range) {
        return Math.max(range[0], Math.min(x, range[1]));
    }

    /**
    * @returns {Boolean} true if agent is probably a mobile device. Don't really care if this is accurate.
    */
    private isMobile() {
        return (/android|blackberry|iemobile|ipad|iphone|ipod|opera mini|webos/i.test(navigator.userAgent));
    }

    /**
    * Calculate distortion of the wind vector caused by the shape of the projection at point (x, y). The wind
    * vector is modified in place and returned by this function.
    */
    private distort(projection, lon, lat, x, y, scale, wind, windy) {
        var u = wind[0] * scale;
        var v = wind[1] * scale;
        var d = this.distortion(projection, lon, lat, x, y, windy);

        // Scale distortion vectors by u and v, then add.
        wind[0] = d[0] * u + d[2] * v;
        wind[1] = d[1] * u + d[3] * v;
        return wind;
    }

    private distortion(projection, lon, lat, x, y, windy) {
        let tau = 2 * Math.PI;
        let H = Math.pow(10, -5.2);
        let hLon = lon < 0 ? H : -H;
        let hLat = lat < 0 ? H : -H;

        let pLon = this.project(lat, lon + hLon, windy);
        let pLat = this.project(lat + hLat, lon, windy);

        // Meridian scale factor (see Snyder, equation 4-3), where R = 1. This handles issue where length of 1º λ
        // changes depending on φ. Without this, there is a pinching effect at the poles.
        let k = Math.cos(lat / 360 * tau);
        return [(pLon[0] - x) / hLon / k, (pLon[1] - y) / hLon / k, (pLat[0] - x) / hLat, (pLat[1] - y) / hLat];
    }

    private mercY(lat) {
        return Math.log(Math.tan(lat / 2 + Math.PI / 4));
    }

    private project(lat, lon, windy) {
        // both in radians, use deg2rad if neccessary
        let ymin = this.mercY(windy.south);
        let ymax = this.mercY(windy.north);
        let xFactor = windy.width / (windy.east - windy.west);
        let yFactor = windy.height / (ymax - ymin);

        let y = this.mercY(this.deg2rad(lat));
        let x = (this.deg2rad(lon) - windy.west) * xFactor;
        y = (ymax - y) * yFactor; // y points south
        return [x, y];
    }

    private invert(x, y, windy) {
        let mapLonDelta = windy.east - windy.west;
        let worldMapRadius = windy.width / this.rad2deg(mapLonDelta) * 360 / (2 * Math.PI);
        let mapOffsetY = worldMapRadius / 2 * Math.log((1 + Math.sin(windy.south)) / (1 - Math.sin(windy.south)));
        let equatorY = windy.height + mapOffsetY;
        let a = (equatorY - y) / worldMapRadius;

        let lat = 180 / Math.PI * (2 * Math.atan(Math.exp(a)) - Math.PI / 2);
        let lon = this.rad2deg(windy.west) + x / windy.width * this.rad2deg(mapLonDelta);
        return [lon, lat];
    }


    private interpolateField(grid, bounds: Bounds, extent, callback) {

        let projection = {};
        let mapArea = (extent.south - extent.north) * (extent.west - extent.east);
        let velocityScale = this.displayOptions.velocityScale * Math.pow(mapArea, 0.4);

        let columns = [];
        let x = bounds.x;

        let interpolateColumn = (x) => {
            let column = [];
            for (let y = bounds.y; y <= bounds.yMax; y += 2) {
                let coord = this.invert(x, y, extent);
                if (coord) {
                    var lon = coord[0],
                        lat = coord[1];
                    if (isFinite(lon)) {
                        let wind = this.interpolate(lon, lat);
                        if (wind) {
                            wind = this.distort(projection, lon, lat, x, y, velocityScale, wind, extent);
                            column[y + 1] = column[y] = wind;
                        }
                    }
                }
            }
            columns[x + 1] = columns[x] = column;
        };

        let batchInterpolate = () => {
            let start = Date.now();
            while (x < bounds.width) {
                interpolateColumn(x);
                x += 2;
                if (Date.now() - start > 1000) {
                    //MAX_TASK_TIME) {
                    setTimeout(() => batchInterpolate, 25);
                    return;
                }
            }
            this.createField(columns, bounds, callback);
        };
        batchInterpolate();
    }


    private createField(columns, bounds: Bounds, callback) {

        /**
        * @returns {Array} wind vector [u, v, magnitude] at the point (x, y), or [NaN, NaN, null] if wind
        *          is undefined at that point.
        */
        let field: any = (x, y) => {
            var column = columns[Math.round(x)];
            return column && column[Math.round(y)] || this.NULL_WIND_VECTOR;
        }

        // Frees the massive "columns" array for GC. Without this, the array is leaked (in Chrome) each time a new
        // field is interpolated because the field closure's context is leaked, for reasons that defy explanation.
        field.release = () => {
            columns = [];
        };

        field.randomize = (o: Particle) => {
            // UNDONE: this method is terrible
            let x, y;
            let safetyNet = 0;
            do {
                x = Math.round(Math.floor(Math.random() * bounds.width) + bounds.x);
                y = Math.round(Math.floor(Math.random() * bounds.height) + bounds.y);
            } while (field(x, y)[2] === null && safetyNet++ < 30);
            o.x = x;
            o.y = y;
            return o;
        };

        callback(bounds, field);
    }

    private animate(bounds: Bounds, field) {

        let windIntensityColorScale = (min, max) => {
            this.colorScale.indexFor = (m) => {
                // map velocity speed to a style
                return Math.max(0, Math.min(this.colorScale.length - 1, Math.round((m - min) / (max - min) * (this.colorScale.length - 1))));
            };
            return this.colorScale;
        }

        let colorStyles = windIntensityColorScale(this.displayOptions.minVelocity, this.displayOptions.maxVelocity);
        let buckets = colorStyles.map(function () {
            return [];
        });

        // based on the density setting, add that many per 50px x 50px
        let densityRatio = 50 * window.devicePixelRatio;
        let densityMultiplier = (bounds.width / densityRatio) * (bounds.height / densityRatio);
        let particleCount = Math.ceil(this.calculatedDensity * densityMultiplier);

        if (this.isMobile()) {
            particleCount *= this.displayOptions.particleReduction;
        }

        let particles: Particle[] = [];
        for (let i = 0; i < particleCount; i++) {
            particles.push(field.randomize({ age: Math.floor(Math.random() * this.displayOptions.particleAge) + 0 }));
        }

        let evolve = () => {
            buckets.forEach((bucket: Particle[]) => {
                bucket.length = 0;
            });
            particles.forEach((particle) => {
                if (particle.age > this.displayOptions.particleAge) {
                    field.randomize(particle).age = 0;
                }
                var x = particle.x;
                var y = particle.y;
                var v = field(x, y); // vector at current position
                var m = v[2];
                particle.currentVector = v;
                if (m === null) {
                    particle.age = this.displayOptions.particleAge; // particle has escaped the grid, never to return...
                } else {
                    var xt = x + v[0];
                    var yt = y + v[1];
                    if (field(xt, yt)[2] !== null) {
                        // Path from (x,y) to (xt,yt) is visible, so add this particle to the appropriate draw bucket.
                        particle.xt = xt;
                        particle.yt = yt;
                        buckets[colorStyles.indexFor(m)].push(particle);
                    } else {
                        // Particle isn't visible, but it still moves through the field.
                        particle.x = xt;
                        particle.y = yt;
                    }
                }
                particle.age += 1;
            });
        }

        let g = this.canvas.getContext("2d");

        let fadeFillStyle = "rgba(0, 0, 0, 0.97)";
        g.fillStyle = fadeFillStyle;
        g.globalAlpha = 0.6;

        let draw = () => {

            if (!this.displayOptions.customFadeFunction) {
                // Fade existing particle trails - using the default settings
                g.globalCompositeOperation = "destination-in";
                g.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
                g.globalCompositeOperation = "lighter";
                g.globalAlpha = 0.95;
            }
            else {
                // call the custom function provided by the caller so they can control fade out completely.
                this.displayOptions.customFadeFunction(g, bounds);
            }
            
            // Draw new particle trails.
            buckets.forEach((bucket: Particle[], i) => {
                if (bucket.length > 0) {

                    if (!this.displayOptions.customDrawFunction) {
                        // default drawing, draw a line
                        g.beginPath();
                        g.strokeStyle = colorStyles[i];
                        bucket.forEach((particle) => {
                            g.lineWidth = this.displayOptions.lineWidth;
                            g.moveTo(particle.x, particle.y);
                            g.lineTo(particle.xt, particle.yt);
                            particle.x = particle.xt;
                            particle.y = particle.yt;

                        });
                        g.stroke();
                    }
                    else {
                        // custom draw function specified, so pass each particle to it and then update the particle position
                        bucket.forEach((particle) => {
                            this.displayOptions.customDrawFunction(g, particle, colorStyles[i]);
                            particle.x = particle.xt;
                            particle.y = particle.yt;
                        });
                    }
                }
            });
        }

        let then = Date.now();
        let frame = () => {
            Windy.animationLoop = requestAnimationFrame(frame);
            var now = Date.now();
            var delta = now - then;
            if (delta > this.FRAME_TIME) {
                then = now - delta % this.FRAME_TIME;
                evolve();
                draw();
            }
        };
        frame();
    }
}

if (!window.cancelAnimationFrame) {
    window.cancelAnimationFrame = (id) => {
        clearTimeout(id);
    };
}