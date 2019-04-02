# AnimatedEnvironmentLayer

Supports arcgis-js-api v4.11.
See the branches for a working version for v4.6 - v4.10.

An arcgis js api layer that can display data from GRIB2 files as animated particles.
Uses a canvas to render the particles.

Demo page here: [http://animatedenvironmentlayer.azurewebsites.net/index.html](http://animatedenvironmentlayer.azurewebsites.net/index.html)

GRIB files are a common format for meteorologcical data. See here for more info: [https://en.wikipedia.org/wiki/GRIB](https://en.wikipedia.org/wiki/GRIB). 

Things such as wind, currents, waves etc can be modelled, anything with a velocity and direction. There's two wind files and one wave file used as test data included in the repo.

You can use grib files that contain a direction and velocity set of data. Standard use is wind data that has u and v components, but you can use a number of different grib types as long as one is direction and one is velocity and it will convert them to u and v datasets. See the swell dataset for an example of this.

Supports scan mode 0 and 64.

The layer requires the GRIB files to be converted to json for use. This tool is used to do that conversion:
[https://github.com/cambecc/grib2json](https://github.com/cambecc/grib2json)

Has lots of options for flexible drawing. The global wind 2 option in the demo that is also in this repo has examples on how to use the more complex options. Here's the display options api that can be set to change the particle display.
Best bet is to just look at the code in the repo though.

```javascript
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

```

# Credit
This is essentially an arcgis and typescript port of this awesome project -

[https://github.com/danwild/leaflet-velocity](https://github.com/danwild/leaflet-velocity), so check that out.

That project takes inspiration from the following two projects which are well worth checking out as well!

[https://github.com/Esri/wind-js](https://github.com/Esri/wind-js)

[https://github.com/cambecc/earth](https://github.com/cambecc/earth)

@danwild also has this project which could help with downloading new data files.

[https://github.com/danwild/wind-js-server](https://github.com/danwild/wind-js-server)

# Usage

If you want to run the repo locally, just do an npm install and npm start. The reload server will spin up the app and watch for file changes to trigger recompilation.

There's no @types package for dojo v11.x yet, but there is an npm package 'dojo-typings'. Even the dojo-typings package doesn't go as high as 1.12.x which arcgis now uses. Had to just include a reference to the dojo types in a custom index.d.ts file.

You could just copy the typescript file `./typescript/animatedEnvironmentLayer.ts` and compile it your own project.
Alternatively you could use precompiled amd module `./ael/animatedEnvironmentLayer.js` if you're not using typescript.

# Notes

Doesn't work with 3d yet...will work on it as I'd like 3d support. I'm no expert with webgl though so it could be a while, if ever. Help is welcome!

