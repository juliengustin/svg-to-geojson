// Largely cribbed from jakearchibald/svgomg

import svg2js from 'svgo/lib/svgo/svg2js';
import js2svg from 'svgo/lib/svgo/js2svg';
import JSAPI from 'svgo/lib/svgo/jsAPI';
import CSSClassList from 'svgo/lib/svgo/css-class-list';
import CSSStyleDeclaration from 'svgo/lib/svgo/css-style-declaration';
import plugins from 'svgo/lib/svgo/plugins';

import removeDoctype from 'svgo/plugins/removeDoctype';
import removeXMLProcInst from 'svgo/plugins/removeXMLProcInst';
import removeComments from 'svgo/plugins/removeComments';
import removeMetadata from 'svgo/plugins/removeMetadata';
import removeXMLNS from 'svgo/plugins/removeXMLNS';
import removeEditorsNSData from 'svgo/plugins/removeEditorsNSData';
import cleanupAttrs from 'svgo/plugins/cleanupAttrs';
import inlineStyles from 'svgo/plugins/inlineStyles';
import minifyStyles from 'svgo/plugins/minifyStyles';
import convertStyleToAttrs from 'svgo/plugins/convertStyleToAttrs';
import cleanupIDs from 'svgo/plugins/cleanupIDs';
import removeRasterImages from 'svgo/plugins/removeRasterImages';
import removeUselessDefs from 'svgo/plugins/removeUselessDefs';
import cleanupNumericValues from 'svgo/plugins/cleanupNumericValues';
import cleanupListOfValues from 'svgo/plugins/cleanupListOfValues';
import convertColors from 'svgo/plugins/convertColors';
import removeUnknownsAndDefaults from 'svgo/plugins/removeUnknownsAndDefaults';
import removeNonInheritableGroupAttrs from 'svgo/plugins/removeNonInheritableGroupAttrs';
import removeUselessStrokeAndFill from 'svgo/plugins/removeUselessStrokeAndFill';
import removeViewBox from 'svgo/plugins/removeViewBox';
import cleanupEnableBackground from 'svgo/plugins/cleanupEnableBackground';
import removeHiddenElems from 'svgo/plugins/removeHiddenElems';
import removeEmptyText from 'svgo/plugins/removeEmptyText';
import convertShapeToPath from 'svgo/plugins/convertShapeToPath';
import moveElemsAttrsToGroup from 'svgo/plugins/moveElemsAttrsToGroup';
import moveGroupAttrsToElems from 'svgo/plugins/moveGroupAttrsToElems';
import collapseGroups from 'svgo/plugins/collapseGroups';
import convertPathData from 'svgo/plugins/convertPathData';
import convertTransform from 'svgo/plugins/convertTransform';
import removeEmptyAttrs from 'svgo/plugins/removeEmptyAttrs';
import removeEmptyContainers from 'svgo/plugins/removeEmptyContainers';
import mergePaths from 'svgo/plugins/mergePaths';
import removeUnusedNS from 'svgo/plugins/removeUnusedNS';
import sortAttrs from 'svgo/plugins/sortAttrs';
import removeTitle from 'svgo/plugins/removeTitle';
import removeDesc from 'svgo/plugins/removeDesc';
import removeDimensions from 'svgo/plugins/removeDimensions';
import removeStyleElement from 'svgo/plugins/removeStyleElement';
import removeScriptElement from 'svgo/plugins/removeScriptElement';

// the order is from https://github.com/svg/svgo/blob/master/.svgo.yml
// Some are commented out if they have no default action.
const pluginsData = {
  removeDoctype,
  removeXMLProcInst,
  removeComments,
  removeMetadata,
  removeXMLNS,
  removeEditorsNSData,
  cleanupAttrs,
  inlineStyles,
  minifyStyles,
  convertStyleToAttrs,
  /*
  * cleanupIDs removes ids from the svg path. We want to preserve those as properties in the GeoJSON
  */
  // cleanupIDs,
  //prefixIds,
  removeRasterImages,
  removeUselessDefs,
  cleanupNumericValues,
  cleanupListOfValues,
  convertColors,
  removeUnknownsAndDefaults,
  removeNonInheritableGroupAttrs,
  removeUselessStrokeAndFill,
  removeViewBox,
  cleanupEnableBackground,
  removeHiddenElems,
  removeEmptyText,
  convertShapeToPath,
  moveElemsAttrsToGroup,
  moveGroupAttrsToElems,
  collapseGroups,
  convertPathData,
  convertTransform,
  removeEmptyAttrs,
  removeEmptyContainers,
  mergePaths,
  removeUnusedNS,
  sortAttrs,
  removeTitle,
  removeDesc,
  removeDimensions,
  //removeAttrs,
  //removeElementsByAttr,
  //addClassesToSVGElement,
  removeStyleElement,
  removeScriptElement,
  //addAttributesToSVGElement,
};

// Clone is currently broken. Hack it:
function cloneParsedSvg(svg) {
  const clones = new Map();

  function cloneKeys(target, obj) {
    for (const key of Object.keys(obj)) {
      target[key] = clone(obj[key]);
    }
    return target;
  }

  function clone(obj) {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (clones.has(obj)) {
      return clones.get(obj);
    }

    let objClone;

    if (obj.constructor === JSAPI) {
      objClone = new JSAPI({}, obj.parentNode);
      clones.set(obj, objClone);

      if (obj.parentNode) {
        objClone.parentNode = clone(obj.parentNode);
      }
      cloneKeys(objClone, obj);
    }
    else if (
      obj.constructor === CSSClassList ||
      obj.constructor === CSSStyleDeclaration ||
      obj.constructor === Object ||
      obj.constructor === Array
    ) {
      objClone = new obj.constructor();
      clones.set(obj, objClone);
      cloneKeys(objClone, obj);
    }
    else if (obj.constructor === Map) {
      objClone = new Map();
      clones.set(obj, objClone);

      for (const [key, val] of obj) {
        objClone.set(clone(key), clone(val));
      }
    }
    else if (obj.constructor === Set) {
      objClone = new Set();
      clones.set(obj, objClone);

      for (const val of obj) {
        objClone.add(clone(val));
      }
    }
    else {
      throw Error('unexpected type');
    }

    return objClone;
  }

  return clone(svg);
}

// Arrange plugins by type - this is what plugins() expects
function optimizePluginsArray(plugins) {
  return plugins.map(item => [item]).reduce((arr, item) => {
    const last = arr[arr.length - 1];

    if (last && item[0].type === last[0].type) {
      last.push(item[0]);
    }
    else {
      arr.push(item);
    }
    return arr;
  }, []);
}

const optimisedPluginsData = optimizePluginsArray(Object.values(pluginsData));

function getDimensions(parsedSvg) {
  const svgEl = parsedSvg.content.filter(el => el.isElem('svg'))[0];

  if (!svgEl) {
    return {};
  }

  if (svgEl.hasAttr('width') && svgEl.hasAttr('height')) {
    return {
      width: parseFloat(svgEl.attr('width').value),
      height: parseFloat(svgEl.attr('height').value)
    };
  }

  if (svgEl.hasAttr('viewBox')) {
    const viewBox = svgEl.attr('viewBox').value.split(/(?:,\s*|\s+)/);

    return {
      width: parseFloat(viewBox[2]),
      height: parseFloat(viewBox[3])
    };
  }

  return {};
}

self.addEventListener('message', e => {
  const { svg } = e.data;

  svg2js(svg, parsedSvg => {
    if (parsedSvg.error) {
      throw Error(parsed.error);
    }

    const svg = cloneParsedSvg(parsedSvg);

    let cleanSvg;
    plugins(svg, {input: 'string'}, optimisedPluginsData);

    cleanSvg = js2svg(svg, { indent: '  ' }).data;
    self.postMessage(cleanSvg);
  });
});
