/// <reference path="../typings/index.d.ts" />
define(["require", "exports", "esri/views/MapView", "esri/Map", "esri/geometry/Point", "esri/geometry/SpatialReference", "esri/Basemap", "dojo/on", "dojo/dom", "./animatedEnvironmentLayer"], function (require, exports, MapView, Map, Point, SpatialReference, Basemap, on, dom, animatedEnvironmentLayer_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var PageSetup = (function () {
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
                dom.byId("direction").innerHTML = rpt.direction ? rpt.direction.toFixed(1) : "n/a";
                dom.byId("speed").innerHTML = rpt.speed ? rpt.speed.toFixed(2) : "n/a";
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
            //setup some data options
            var globalWind = {
                url: "./data/global-wind.json",
                id: "Global wind",
                displayOptions: {
                    maxVelocity: 15
                }
            };
            // change up some display options to make it look different for global wind 2.
            var globalWind2 = {
                url: "./data/global-wind2.json",
                id: "Global wind 2",
                displayOptions: {
                    maxVelocity: 15,
                    lineWidth: 8,
                    particleAge: 30,
                    particleMultiplier: 0.001
                }
            };
            this._dataOptions.push(globalWind);
            this._dataOptions.push(globalWind2);
            var select = dom.byId("data-select");
            this._dataOptions.forEach(function (opt) {
                var element = document.createElement("option");
                element.id = opt.id;
                element.innerHTML = opt.id;
                select.appendChild(element);
            });
        };
        PageSetup.prototype._basemapChange = function (id) {
            var bm = Basemap.fromId(id);
            this.map.basemap = bm;
        };
        return PageSetup;
    }());
    exports.PageSetup = PageSetup;
});

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3R5cGVzY3JpcHQvcGFnZVNldHVwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDhDQUE4Qzs7OztJQW9COUM7UUFVSTtZQUZRLGlCQUFZLEdBQWlCLEVBQUUsQ0FBQztRQUd4QyxDQUFDO1FBRUQsd0JBQUksR0FBSjtZQUFBLGlCQXFDQztZQW5DRyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztZQUV4QixJQUFJLFNBQVMsR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQzVDLElBQUksQ0FBQyxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUM7Z0JBQ2YsT0FBTyxFQUFFLFNBQVM7YUFDckIsQ0FBQyxDQUFDO1lBRUgsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLE9BQU8sQ0FBQztnQkFDdkIsU0FBUyxFQUFFLFVBQVU7Z0JBQ3JCLE1BQU0sRUFBRSxJQUFJLEtBQUssQ0FBQyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLGdCQUFnQixFQUFFLElBQUksZ0JBQWdCLENBQUMsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDO2dCQUM3RixJQUFJLEVBQUUsQ0FBQztnQkFDUCxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUc7Z0JBQ2IsRUFBRSxFQUFFLEVBQUUsVUFBVSxFQUFFLENBQUMsU0FBUyxFQUFFLE1BQU0sQ0FBQyxFQUFFO2FBQzFDLENBQUMsQ0FBQztZQUNILElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsY0FBYyxDQUFDLENBQUM7WUFDN0MsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxjQUFjLENBQUMsQ0FBQztZQUVoRCxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSxtREFBd0IsQ0FBQztnQkFDakQsRUFBRSxFQUFFLFdBQVc7Z0JBQ2YsR0FBRyxF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QUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDbkMsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7WUFFcEMsSUFBSSxNQUFNLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztZQUNyQyxJQUFJLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxVQUFDLEdBQUc7Z0JBQzFCLElBQUksT0FBTyxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQy9DLE9BQU8sQ0FBQyxFQUFFLEdBQUcsR0FBRyxDQUFDLEVBQUUsQ0FBQztnQkFDcEIsT0FBTyxDQUFDLFNBQVMsR0FBRyxHQUFHLENBQUMsRUFBRSxDQUFDO2dCQUMzQixNQUFNLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ2hDLENBQUMsQ0FBQyxDQUFDO1FBQ1AsQ0FBQztRQUVPLGtDQUFjLEdBQXRCLFVBQXVCLEVBQUU7WUFDckIsSUFBSSxFQUFFLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUM1QixJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sR0FBRyxFQUFFLENBQUM7UUFDMUIsQ0FBQztRQUNMLGdCQUFDO0lBQUQsQ0EzR0EsQUEyR0MsSUFBQTtJQTNHWSw4QkFBUyIsImZpbGUiOiJwYWdlU2V0dXAuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi4vdHlwaW5ncy9pbmRleC5kLnRzXCIgLz5cclxuXHJcbmltcG9ydCAqIGFzIE1hcFZpZXcgZnJvbSBcImVzcmkvdmlld3MvTWFwVmlld1wiO1xyXG5pbXBvcnQgKiBhcyBTY2VuZVZpZXcgZnJvbSBcImVzcmkvdmlld3MvU2NlbmVWaWV3XCI7XHJcbmltcG9ydCAqIGFzIE1hcCBmcm9tIFwiZXNyaS9NYXBcIjtcclxuaW1wb3J0ICogYXMgUG9pbnQgZnJvbSBcImVzcmkvZ2VvbWV0cnkvUG9pbnRcIjtcclxuaW1wb3J0ICogYXMgU3BhdGlhbFJlZmVyZW5jZSBmcm9tIFwiZXNyaS9nZW9tZXRyeS9TcGF0aWFsUmVmZXJlbmNlXCI7XHJcbmltcG9ydCAqIGFzIEJhc2VtYXAgZnJvbSBcImVzcmkvQmFzZW1hcFwiO1xyXG5pbXBvcnQgKiBhcyBvbiBmcm9tIFwiZG9qby9vblwiO1xyXG5pbXBvcnQgKiBhcyBkb20gZnJvbSBcImRvam8vZG9tXCI7XHJcbmltcG9ydCAqIGFzIGRvbUNsYXNzIGZyb20gXCJkb2pvL2RvbS1jbGFzc1wiO1xyXG5cclxuaW1wb3J0IHsgQW5pbWF0ZWRFbnZpcm9ubWVudExheWVyLCBEaXNwbGF5T3B0aW9ucyB9IGZyb20gXCIuL2FuaW1hdGVkRW52aXJvbm1lbnRMYXllclwiO1xyXG5cclxuaW50ZXJmYWNlIERhdGFPcHRpb24ge1xyXG4gICAgaWQ6IHN0cmluZztcclxuICAgIHVybDogc3RyaW5nO1xyXG4gICAgZGlzcGxheU9wdGlvbnM6IERpc3BsYXlPcHRpb25zO1xyXG59XHJcblxyXG5leHBvcnQgY2xhc3MgUGFnZVNldHVwIHtcclxuXHJcbiAgICBtYXA6IE1hcDtcclxuICAgIG1hcFZpZXc6IE1hcFZpZXc7XHJcbiAgICBzY2VuZVZpZXc6IFNjZW5lVmlldztcclxuICAgIGFjdGl2ZVZpZXc6IE1hcFZpZXcgfCBTY2VuZVZpZXc7XHJcbiAgICBlbnZpcm9ubWVudExheWVyOiBBbmltYXRlZEVudmlyb25tZW50TGF5ZXI7XHJcblxyXG4gICAgcHJpdmF0ZSBfZGF0YU9wdGlvbnM6IERhdGFPcHRpb25bXSA9IFtdO1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKCkge1xyXG4gICAgfVxyXG5cclxuICAgIGluaXQoKSB7XHJcblxyXG4gICAgICAgIHRoaXMuX2luaXREYXRhT3B0aW9ucygpO1xyXG5cclxuICAgICAgICBsZXQgc2F0ZWxsaXRlID0gQmFzZW1hcC5mcm9tSWQoXCJzYXRlbGxpdGVcIik7XHJcbiAgICAgICAgdGhpcy5tYXAgPSBuZXcgTWFwKHtcclxuICAgICAgICAgICAgYmFzZW1hcDogc2F0ZWxsaXRlXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHRoaXMubWFwVmlldyA9IG5ldyBNYXBWaWV3KHtcclxuICAgICAgICAgICAgY29udGFpbmVyOiBcIm1hcC12aWV3XCIsXHJcbiAgICAgICAgICAgIGNlbnRlcjogbmV3IFBvaW50KHsgeDogMTM0LCB5OiAtMjQsIHNwYXRpYWxSZWZlcmVuY2U6IG5ldyBTcGF0aWFsUmVmZXJlbmNlKHsgd2tpZDogNDMyNiB9KSB9KSxcclxuICAgICAgICAgICAgem9vbTogNCxcclxuICAgICAgICAgICAgbWFwOiB0aGlzLm1hcCxcclxuICAgICAgICAgICAgdWk6IHsgY29tcG9uZW50czogW1wiY29tcGFzc1wiLCBcInpvb21cIl0gfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHRoaXMubWFwVmlldy51aS5tb3ZlKFwiem9vbVwiLCBcImJvdHRvbS1yaWdodFwiKTtcclxuICAgICAgICB0aGlzLm1hcFZpZXcudWkubW92ZShcImNvbXBhc3NcIiwgXCJib3R0b20tcmlnaHRcIik7XHJcblxyXG4gICAgICAgIHRoaXMuZW52aXJvbm1lbnRMYXllciA9IG5ldyBBbmltYXRlZEVudmlyb25tZW50TGF5ZXIoe1xyXG4gICAgICAgICAgICBpZDogXCJhZWwtbGF5ZXJcIixcclxuICAgICAgICAgICAgdXJsOiB0aGlzLl9kYXRhT3B0aW9uc1swXS51cmwsXHJcbiAgICAgICAgICAgIGRpc3BsYXlPcHRpb25zOiB0aGlzLl9kYXRhT3B0aW9uc1swXS5kaXNwbGF5T3B0aW9uc1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICB0aGlzLm1hcC5hZGQodGhpcy5lbnZpcm9ubWVudExheWVyKTtcclxuXHJcbiAgICAgICAgLy9zZXR1cCBzb21lIGV2ZW50IGhhbmRsZXJzIHRvIHJlYWN0IHRvIGNoYW5nZSBvZiBvcHRpb25zICAgICAgIFxyXG4gICAgICAgIG9uKGRvbS5ieUlkKFwiZGF0YS1zZWxlY3RcIiksIFwiY2hhbmdlXCIsIChldnQpID0+IHRoaXMuX2RhdGFDaGFuZ2UoZXZ0LnRhcmdldC52YWx1ZSkpO1xyXG4gICAgICAgIG9uKGRvbS5ieUlkKFwiYmFzZW1hcC1zZWxlY3RcIiksIFwiY2hhbmdlXCIsIChldnQpID0+IHRoaXMuX2Jhc2VtYXBDaGFuZ2UoZXZ0LnRhcmdldC52YWx1ZSkpO1xyXG5cclxuICAgICAgICAvLyBzdWJzY3JpYmUgdG8gdGhlIHBvaW50LXJlcG9ydCBldmVudCBhbmQgZGlzcGxheSB0aGUgdmFsdWVzIGluIFVJLlxyXG4gICAgICAgIGxldCB3aW5kTGF5ZXJBbnk6IGFueSA9IHRoaXMuZW52aXJvbm1lbnRMYXllcjtcclxuICAgICAgICB3aW5kTGF5ZXJBbnkub24oXCJwb2ludC1yZXBvcnRcIiwgKHJwdCkgPT4ge1xyXG4gICAgICAgICAgICBkb20uYnlJZChcImRpcmVjdGlvblwiKS5pbm5lckhUTUwgPSBycHQuZGlyZWN0aW9uID8gcnB0LmRpcmVjdGlvbi50b0ZpeGVkKDEpIDogXCJuL2FcIjtcclxuICAgICAgICAgICAgZG9tLmJ5SWQoXCJzcGVlZFwiKS5pbm5lckhUTUwgPSBycHQuc3BlZWQgPyBycHQuc3BlZWQudG9GaXhlZCgyKSA6IFwibi9hXCI7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfZGF0YUNoYW5nZShpZCkge1xyXG4gICAgICAgIGxldCBvcHQgPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMuX2RhdGFPcHRpb25zLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLl9kYXRhT3B0aW9uc1tpXS5pZCA9PT0gaWQpIHtcclxuICAgICAgICAgICAgICAgIG9wdCA9IHRoaXMuX2RhdGFPcHRpb25zW2ldO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKCFvcHQpIHJldHVybjtcclxuICAgICAgICB0aGlzLmVudmlyb25tZW50TGF5ZXIuZGlzcGxheU9wdGlvbnMgPSBvcHQuZGlzcGxheU9wdGlvbnM7XHJcbiAgICAgICAgdGhpcy5lbnZpcm9ubWVudExheWVyLnVybCA9IG9wdC51cmw7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBTZWVkIHNvbWUgb3B0aW9ucyBmb3IgZGF0YVxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF9pbml0RGF0YU9wdGlvbnMoKSB7XHJcblxyXG4gICAgICAgIC8vc2V0dXAgc29tZSBkYXRhIG9wdGlvbnNcclxuICAgICAgICBsZXQgZ2xvYmFsV2luZDogRGF0YU9wdGlvbiA9IHtcclxuICAgICAgICAgICAgdXJsOiBcIi4vZGF0YS9nbG9iYWwtd2luZC5qc29uXCIsXHJcbiAgICAgICAgICAgIGlkOiBcIkdsb2JhbCB3aW5kXCIsXHJcbiAgICAgICAgICAgIGRpc3BsYXlPcHRpb25zOiB7XHJcbiAgICAgICAgICAgICAgICBtYXhWZWxvY2l0eTogMTVcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIC8vIGNoYW5nZSB1cCBzb21lIGRpc3BsYXkgb3B0aW9ucyB0byBtYWtlIGl0IGxvb2sgZGlmZmVyZW50IGZvciBnbG9iYWwgd2luZCAyLlxyXG4gICAgICAgIGxldCBnbG9iYWxXaW5kMjogRGF0YU9wdGlvbiA9IHtcclxuICAgICAgICAgICAgdXJsOiBcIi4vZGF0YS9nbG9iYWwtd2luZDIuanNvblwiLFxyXG4gICAgICAgICAgICBpZDogXCJHbG9iYWwgd2luZCAyXCIsXHJcbiAgICAgICAgICAgIGRpc3BsYXlPcHRpb25zOiB7XHJcbiAgICAgICAgICAgICAgICBtYXhWZWxvY2l0eTogMTUsXHJcbiAgICAgICAgICAgICAgICBsaW5lV2lkdGg6IDgsXHJcbiAgICAgICAgICAgICAgICBwYXJ0aWNsZUFnZTogMzAsXHJcbiAgICAgICAgICAgICAgICBwYXJ0aWNsZU11bHRpcGxpZXI6IDAuMDAxXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICB0aGlzLl9kYXRhT3B0aW9ucy5wdXNoKGdsb2JhbFdpbmQpO1xyXG4gICAgICAgIHRoaXMuX2RhdGFPcHRpb25zLnB1c2goZ2xvYmFsV2luZDIpO1xyXG5cclxuICAgICAgICBsZXQgc2VsZWN0ID0gZG9tLmJ5SWQoXCJkYXRhLXNlbGVjdFwiKTtcclxuICAgICAgICB0aGlzLl9kYXRhT3B0aW9ucy5mb3JFYWNoKChvcHQpID0+IHtcclxuICAgICAgICAgICAgbGV0IGVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwib3B0aW9uXCIpO1xyXG4gICAgICAgICAgICBlbGVtZW50LmlkID0gb3B0LmlkO1xyXG4gICAgICAgICAgICBlbGVtZW50LmlubmVySFRNTCA9IG9wdC5pZDtcclxuICAgICAgICAgICAgc2VsZWN0LmFwcGVuZENoaWxkKGVsZW1lbnQpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2Jhc2VtYXBDaGFuZ2UoaWQpIHtcclxuICAgICAgICBsZXQgYm0gPSBCYXNlbWFwLmZyb21JZChpZCk7XHJcbiAgICAgICAgdGhpcy5tYXAuYmFzZW1hcCA9IGJtO1xyXG4gICAgfVxyXG59Il19
