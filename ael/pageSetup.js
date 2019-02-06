/// <reference path="../typings/index.d.ts" />
define(["require", "exports", "esri/views/MapView", "esri/Map", "esri/geometry/Point", "esri/geometry/SpatialReference", "esri/Basemap", "dojo/on", "dojo/dom", "./animatedEnvironmentLayer"], function (require, exports, MapView, Map, Point, SpatialReference, Basemap, on, dom, animatedEnvironmentLayer_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var PageSetup = /** @class */ (function () {
        function PageSetup() {
            this._dataOptions = [];
        }
        PageSetup.prototype.init = function () {
            var _this = this;
            this._initDataOptions();
            var satellite = Basemap.fromId("satellite");
            this.map = new Map({
                basemap: satellite
            });
            this.mapView = new MapView({
                container: "map-view",
                center: new Point({ x: 134, y: -24, spatialReference: new SpatialReference({ wkid: 4326 }) }),
                zoom: 4,
                map: this.map,
                ui: { components: ["compass", "zoom"] }
            });
            this.mapView.ui.move("zoom", "bottom-right");
            this.mapView.ui.move("compass", "bottom-right");
            this.environmentLayer = new animatedEnvironmentLayer_1.AnimatedEnvironmentLayer({
                id: "ael-layer",
                url: this._dataOptions[0].url,
                displayOptions: this._dataOptions[0].displayOptions
            });
            this.map.add(this.environmentLayer);
            //setup some event handlers to react to change of options       
            on(dom.byId("data-select"), "change", function (evt) { return _this._dataChange(evt.target.value); });
            on(dom.byId("basemap-select"), "change", function (evt) { return _this._basemapChange(evt.target.value); });
            // subscribe to the point-report event and display the values in UI.
            var windLayerAny = this.environmentLayer;
            windLayerAny.on("point-report", function (rpt) {
                dom.byId("direction").innerHTML = rpt.degree ? rpt.degree.toFixed(1) : "n/a";
                dom.byId("speed").innerHTML = rpt.velocity ? rpt.velocity.toFixed(2) : "n/a";
            });
        };
        PageSetup.prototype._dataChange = function (id) {
            var opt = undefined;
            for (var i = 0, len = this._dataOptions.length; i < len; i++) {
                if (this._dataOptions[i].id === id) {
                    opt = this._dataOptions[i];
                    break;
                }
            }
            if (!opt)
                return;
            this.environmentLayer.displayOptions = opt.displayOptions;
            this.environmentLayer.url = opt.url;
        };
        /**
         * Seed some options for data
         */
        PageSetup.prototype._initDataOptions = function () {
            // setup some data options
            var globalWind = {
                url: "./data/global-wind.json",
                id: "Global wind",
                displayOptions: {
                    maxVelocity: 15
                },
            };
            // Make swell look different to wind
            var ausSwell = {
                url: "./data/auswave_pop_flds_combined.json",
                id: "Australian swell",
                displayOptions: {
                    maxVelocity: 5,
                    lineWidth: 10,
                    particleAge: 30,
                }
            };
            // change up some display options to make it look different for global wind 2.
            var globalWind2 = {
                url: "./data/global-wind2.json",
                id: "Global wind 2",
                displayOptions: {
                    maxVelocity: 15,
                    velocityScale: 0.01,
                    frameRate: 30,
                    particleDensity: [{ zoom: 2, density: 10 }, { zoom: 4, density: 9 }, { zoom: 8, density: 6 }, { zoom: 10, density: 4 }, { zoom: 12, density: 3 }],
                    customFadeFunction: this.customFadeFunction,
                    customDrawFunction: this.customDrawFunction // a custom draw function
                }
            };
            this._dataOptions.push(globalWind);
            this._dataOptions.push(ausSwell);
            this._dataOptions.push(globalWind2);
            var select = dom.byId("data-select");
            this._dataOptions.forEach(function (opt) {
                var element = document.createElement("option");
                element.id = opt.id;
                element.innerHTML = opt.id;
                select.appendChild(element);
            });
        };
        PageSetup.prototype.customDrawFunction = function (context, particle, colorStyle) {
            // draw a circle and make the radius a factor of the magnitude
            var radius = particle.currentVector[2] / 9;
            context.beginPath();
            context.fillStyle = colorStyle;
            context.arc(particle.x, particle.y, radius, 0, 2 * Math.PI);
            context.fill();
        };
        PageSetup.prototype.customFadeFunction = function (context, bounds) {
            // Fade existing particle trails
            context.globalCompositeOperation = "destination-in";
            context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
            context.globalCompositeOperation = "lighter";
            context.globalAlpha = 0.95;
            // perhaps you don't want a trail and just want it cleared between each frame - then just use the below line.
            //context.clearRect(bounds.x, bounds.y, bounds.width, bounds.height);
        };
        PageSetup.prototype._basemapChange = function (id) {
            var bm = Basemap.fromId(id);
            this.map.basemap = bm;
        };
        return PageSetup;
    }());
    exports.PageSetup = PageSetup;
});
//# sourceMappingURL=pageSetup.js.map