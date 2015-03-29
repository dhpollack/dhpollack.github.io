
if (!window.Promise) {
  window.Promise = MakePromise(Polymer.Base.async);
}
;

  Polymer({
    is: 'core-request',

    properties: {

      /**
       * A reference to the XMLHttpRequest instance used to generate the
       * network request.
       *
       * @attribute xhr
       * @type XMLHttpRequest
       * @default `new XMLHttpRequest`
       */
      xhr: {
        type: Object,
        notify: true,
        readOnly: true,
        value: function() {
          this._setXhr(new XMLHttpRequest());
        }
      },

      /**
       * A reference to the parsed response body, if the `xhr` has completely
       * resolved.
       *
       * @attribute response
       * @type *
       * @default null
       */
      response: {
        type: Object,
        notify: true,
        readOnly: true,
        value: function() {
          this._setResponse(null);
        }
      },

      /**
       * A promise that resolves when the `xhr` response comes back, or rejects
       * if there is an error before the `xhr` completes.
       *
       * @attribute completes
       * @type Promise
       * @default `new Promise`
       */
      completes: {
        type: Promise,
        readOnly: true,
        notify: true,
        value: function() {
          var completes = new Promise(function (resolve, reject) {
            this.resolveCompletes = resolve;
            this.rejectCompletes = reject;
          }.bind(this));

          this._setCompletes(completes);
        }
      },

      /**
       * An object that contains progress information emitted by the XHR if
       * available.
       *
       * @attribute progress
       * @type Object
       * @default {}
       */
      progress: {
        type: Object,
        notify: true,
        readOnly: true,
        value: function() {
          this._setProgress({});
        }
      },

      /**
       * Aborted will be true if an abort of the request is attempted.
       *
       * @attribute aborted
       * @type boolean
       * @default false
       */
      aborted: {
        type: Boolean,
        notify: true,
        readOnly: true,
        value: function() {
          this._setAborted(false);
        }
      }
    },

    /**
     * Sends an HTTP request to the server and returns the XHR object.
     *
     * @method request
     * @param {Object} options
     *    @param {String} options.url The url to which the request is sent.
     *    @param {String} options.method The HTTP method to use, default is GET.
     *    @param {boolean} options.async By default, all requests are sent asynchronously. To send synchronous requests, set to true.
     *    @param {Object} options.body The content for the request body for POST method.
     *    @param {Object} options.headers HTTP request headers.
     *    @param {String} options.handleAs The response type. Default is 'text'.
     *    @param {boolean} options.withCredentials Whether or not to send credentials on the request. Default is false.
     * @return Promise
     */
    send: function (options) {
      var xhr = this.xhr;

      if (xhr.readyState > 0) {
        return;
      }

      xhr.addEventListener('readystatechange', function () {
        if (xhr.readyState === 4 && !this.aborted) {
          this._setResponse(this.parseResponse());
          this.resolveCompletes(this.response);
        }
      }.bind(this));

      xhr.addEventListener('progress', function (progress) {
        this._setProgress({
          lengthComputable: progress.lengthComputable,
          loaded: progress.loaded,
          total: progress.total
        });
      }.bind(this))

      xhr.addEventListener('error', function (error) {
        this.rejectCompletes(error)
      }.bind(this));

      xhr.addEventListener('abort', function () {
        this.rejectCompletes(new Error('Request aborted.'));
      }.bind(this));

      xhr.open(
        options.method || 'GET',
        options.url,
        options.async !== false
      );

      if (options.headers) {
        Object.keys(options.headers).forEach(function (requestHeader) {
          xhr.setRequestHeader(
            requestHeader,
            options.headers[requestHeader]
          );
        }, this);
      }

      // In IE, `xhr.responseType` is an empty string when the response
      // returns. Hence, caching it as `xhr._responseType`.
      xhr.responseType = xhr._responseType = options.handleAs;
      xhr.withCredentials = options.withCredentials;

      xhr.send(options.body);

      return this.completes;
    },

    parseResponse: function () {
      var xhr = this.xhr;
      var responseType = this.xhr.responseType ||
        this.xhr._responseType;
      // If we don't have a natural `xhr.responseType`, we prefer parsing
      // `xhr.responseText` over returning `xhr.response`..
      var preferResponseText = !this.xhr.responseType;

      if (window.pauseCode) {
        debugger;
      }

      try {
        switch (responseType) {
          case 'json':
            // If xhr.response is undefined, responseType `json` may
            // not be supported.
            if (preferResponseText || xhr.response === undefined) {
              // If accessing `xhr.responseText` throws, responseType `json`
              // is supported and the result is rightly `undefined`.
              try {
                xhr.responseText;
              } catch (e) {
                return xhr.response;
              }

              // Otherwise, attempt to parse `xhr.responseText` as JSON.
              if (xhr.responseText) {
                return JSON.parse(xhr.responseText);
              }
            }

            return xhr.response;
          case 'xml':
            return xhr.responseXML;
          case 'blob':
          case 'document':
          case 'arraybuffer':
            return xhr.response;
          case 'text':
          default:
            return xhr.responseText;
        }
      } catch (e) {
        this.rejectCompletes(new Error('Could not parse response. ' + e.message));
      }
    },

    abort: function () {
      this._setAborted(true);
      this.xhr.abort();
    }
  });
;

  Polymer({
    is: 'core-ajax',

    /**
     * Fired when a request is sent.
     *
     * @event request
     */

    /**
     * Fired when a response is received.
     *
     * @event response
     */

    /**
     * Fired when an error is received.
     *
     * @event error
     */

    properties: {
      /**
       * The URL target of the request.
       *
       * @attribute url
       * @type string
       * @default ''
       */
      url: {
        type: String,
        value: ''
      },

      /**
       * An object that contains query parameters to be appended to the
       * specified `url` when generating a request.
       *
       * @attribute params
       * @type Object
       * @default {}
       */
      params: {
        type: Object,
        value: function() {
          return {};
        }
      },

      /**
       * The HTTP method to use such as 'GET', 'POST', 'PUT', or 'DELETE'.
       * Default is 'GET'.
       *
       * @attribute method
       * @type string
       * @default 'GET'
       */
      method: {
        type: String,
        value: 'GET'
      },

      /**
       * HTTP request headers to send.
       *
       * Example:
       *
       *     <core-ajax
       *         auto
       *         url="http://somesite.com"
       *         headers='{"X-Requested-With": "XMLHttpRequest"}'
       *         handleAs="json"
       *         on-core-response="{{handleResponse}}"></core-ajax>
       *
       * @attribute headers
       * @type Object
       * @default {}
       */
      headers: {
        type: Object,
        value: function() {
          return {};
        }
      },

      /**
       * Content type to use when sending data. If the contenttype is set
       * and a `Content-Type` header is specified in the `headers` attribute,
       * the `headers` attribute value will take precedence.
       *
       * @attribute contenttype
       * @type string
       * @default 'application/x-www-form-urlencoded'
       */
      contentType: {
        type: String,
        value: 'application/x-www-form-urlencoded'
      },

      /**
       * Optional raw body content to send when method === "POST".
       *
       * Example:
       *
       *     <core-ajax method="POST" auto url="http://somesite.com"
       *         body='{"foo":1, "bar":2}'>
       *     </core-ajax>
       *
       * @attribute body
       * @type Object
       * @default ''
       */
      body: {
        type: String,
        value: ''
      },

      /**
       * Toggle whether XHR is synchronous or asynchronous. Don't change this
       * to true unless You Know What You Are Doing™.
       *
       * @attribute sync
       * @type boolean
       * @default false
       */
      sync: {
        type: Boolean,
        value: false
      },

      /**
       * Specifies what data to store in the `response` property, and
       * to deliver as `event.response` in `response` events.
       *
       * One of:
       *
       *    `text`: uses `XHR.responseText`.
       *
       *    `xml`: uses `XHR.responseXML`.
       *
       *    `json`: uses `XHR.responseText` parsed as JSON.
       *
       *    `arraybuffer`: uses `XHR.response`.
       *
       *    `blob`: uses `XHR.response`.
       *
       *    `document`: uses `XHR.response`.
       *
       * @attribute handleas
       * @type string
       * @default 'json'
       */
      handleAs: {
        type: String,
        value: 'json'
      },

      /**
       * Set the withCredentials flag on the request.
       *
       * @attribute withCredentials
       * @type boolean
       * @default false
       */
      withCredentials: {
        type: Boolean,
        value: false
      },

      /**
       * If true, automatically performs an Ajax request when either `url` or
       * `params` changes.
       *
       * @attribute auto
       * @type boolean
       * @default false
       */
      auto: {
        type: Boolean,
        value: false
      },

      /**
       * If true, error messages will automatically be logged to the console.
       *
       * @attribute verbose
       * @type boolean
       * @default false
       */
      verbose: {
        type: Boolean,
        value: false
      },

      /**
       * Will be set to true if there is at least one in-flight request
       * associated with this core-ajax element.
       *
       * @attribute loading
       * @type boolean
       * @default false
       */
      loading: {
        type: Boolean,
        notify: true,
        readOnly: true
      },

      /**
       * Will be set to the most recent request made by this core-ajax element.
       *
       * @attribute lastrequest
       * @type core-request
       * @default null
       */
      lastRequest: {
        type: Object,
        notify: true,
        readOnly: true
      },

      /**
       * Will be set to the most recent response received by a request
       * that originated from this core-ajax element. The type of the response
       * is determined by the value of `handleas` at the time that the request
       * was generated.
       *
       * @attribute lastresponse
       * @type *
       * @default null
       */
      lastResponse: {
        type: Object,
        notify: true,
        readOnly: true
      },

      /**
       * Will be set to the most recent error that resulted from a request
       * that originated from this core-ajax element.
       *
       * @attribute lasterror
       * @type Error
       * @default null
       */
      lastError: {
        type: Object,
        notify: true,
        readOnly: true
      },

      /**
       * An Array of all in-flight requests originating from this core-ajax
       * element.
       *
       * @attribute activerequests
       * @type Array
       * @default []
       */
      activeRequests: {
        type: Array,
        notify: true,
        readOnly: true,
        value: function() {
          this._setActiveRequests([]);
        }
      }
    },

    observers: {
      'url method headers contentType body sync handleAs withCredentials':
        'requestOptionsChanged'
    },

    configure: function() {
      return {
        _boundHandleResponse: this.handleResponse.bind(this),
        _boundHandleError: this.handleError.bind(this),
        _boundDiscardRequest: this.discardRequest.bind(this)
      };
    },

    get queryString () {
      var queryParts = [];
      var param;
      var value;

      for (param in this.params) {
        value = this.params[param];
        param = window.encodeURIComponent(param);

        if (value !== null) {
          param += '=' + window.encodeURIComponent(value);
        }

        queryParts.push(param);
      }

      return queryParts.join('&');
    },

    get requestUrl() {
      var queryString = this.queryString;

      if (queryString) {
        return this.url + '?' + queryString;
      }

      return this.url;
    },

    get requestHeaders() {
      var headers = Object.create(this.headers || {});

      if (!('content-type' in headers)) {
        headers['content-type'] = this.contentType;
      }

      return headers;
    },

    toRequestOptions: function() {
      return {
        url: this.requestUrl,
        method: this.method,
        headers: this.requestHeaders,
        body: this.body,
        async: !this.sync,
        handleAs: this.handleAs,
        withCredentials: this.withCredentials
      };
    },

    requestOptionsChanged: function() {
      if (this.auto) {
        this.generateRequest();
      }
    },

    /**
     * Performs an AJAX request to the specified URL.
     *
     * @method generateRequest
     */
    generateRequest: function() {
      var request = document.createElement('core-request');
      var requestOptions = this.toRequestOptions();

      this.activeRequests.push(request);

      request.completes.then(
        this._boundHandleResponse
      ).catch(
        this._boundHandleError
      ).then(
        this._boundDiscardRequest
      );

      request.send(requestOptions);

      this._setLastRequest(request);

      this.fire('request', {
        xhr: request.xhr,
        options: requestOptions
      });

      return request;
    },

    handleResponse: function(response) {
      this._setLastResponse(response);
      this.fire('response', response);
    },

    handleError: function(error) {
      if (this.verbose) {
        console.error(error);
      }

      this._setLastError(error);
      this.fire('error', error);
    },

    discardRequest: function(request) {
      var requestIndex = this.activeRequests.indexOf(request);

      if (requestIndex > 0) {
        this.activeRequests.splice(requestIndex, 1);
      }
    }
  });
;

  (function() {
    var Utility = {
      cssColorWithAlpha: function(cssColor, alpha) {
        var parts = cssColor.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);

        if (typeof alpha == 'undefined') {
          alpha = 1;
        }

        if (!parts) {
          return 'rgba(255, 255, 255, ' + alpha + ')';
        }

        return 'rgba(' + parts[1] + ', ' + parts[2] + ', ' + parts[3] + ', ' + alpha + ')';
      },

      distance: function(x1, y1, x2, y2) {
        var xDelta = (x1 - x2);
        var yDelta = (y1 - y2);

        return Math.sqrt(xDelta * xDelta + yDelta * yDelta);
      },

      now: (function() {
        if (window.performance && window.performance.now) {
          return window.performance.now.bind(window.performance);
        }

        return Date.now;
      })()
    };

    function ElementMetrics(element) {
      this.element = element;
      this.width = this.boundingRect.width;
      this.height = this.boundingRect.height;

      this.size = Math.max(this.width, this.height);
    }

    ElementMetrics.prototype = {
      get boundingRect () {
        return this.element.getBoundingClientRect();
      },

      furthestCornerDistanceFrom: function(x, y) {
        var topLeft = Utility.distance(x, y, 0, 0);
        var topRight = Utility.distance(x, y, this.width, 0);
        var bottomLeft = Utility.distance(x, y, 0, this.height);
        var bottomRight = Utility.distance(x, y, this.width, this.height);

        return Math.max(topLeft, topRight, bottomLeft, bottomRight);
      }
    };

    function Ripple(element) {
      this.element = element;
      this.color = window.getComputedStyle(element).color;

      this.wave = document.createElement('div');
      this.waveContainer = document.createElement('div');
      this.wave.style.backgroundColor = this.color;
      this.wave.classList.add('wave');
      this.waveContainer.classList.add('wave-container');
      Polymer.dom(this.waveContainer).appendChild(this.wave);

      this.resetInteractionState();
    }

    Ripple.MAX_RADIUS = 300;

    Ripple.prototype = {
      get recenters() {
        return this.element.recenters;
      },

      get mouseDownElapsed() {
        var elapsed;

        if (!this.mouseDownStart) {
          return 0;
        }

        elapsed = Utility.now() - this.mouseDownStart;

        if (this.mouseUpStart) {
          elapsed -= this.mouseUpElapsed;
        }

        return elapsed;
      },

      get mouseUpElapsed() {
        return this.mouseUpStart ?
          Utility.now () - this.mouseUpStart : 0;
      },

      get mouseDownElapsedSeconds() {
        return this.mouseDownElapsed / 1000;
      },

      get mouseUpElapsedSeconds() {
        return this.mouseUpElapsed / 1000;
      },

      get mouseInteractionSeconds() {
        return this.mouseDownElapsedSeconds + this.mouseUpElapsedSeconds;
      },

      get initialOpacity() {
        return this.element.initialOpacity;
      },

      get opacityDecayVelocity() {
        return this.element.opacityDecayVelocity;
      },

      get radius() {
        var width2 = this.containerMetrics.width * this.containerMetrics.width;
        var height2 = this.containerMetrics.height * this.containerMetrics.height;
        var waveRadius = Math.min(
          Math.sqrt(width2 + height2),
          Ripple.MAX_RADIUS
        ) * 1.1 + 5;

        var duration = 1.1 - 0.2 * (waveRadius / Ripple.MAX_RADIUS);
        var timeNow = this.mouseInteractionSeconds / duration;
        var size = waveRadius * (1 - Math.pow(80, -timeNow));

        return Math.abs(size);
      },

      get opacity() {
        if (!this.mouseUpStart) {
          return this.initialOpacity;
        }

        return Math.max(
          0,
          this.initialOpacity - this.mouseUpElapsedSeconds * this.opacityDecayVelocity
        );
      },

      get outerOpacity() {
        // Linear increase in background opacity, capped at the opacity
        // of the wavefront (waveOpacity).
        var outerOpacity = this.mouseUpElapsedSeconds * 0.3;
        var waveOpacity = this.opacity;

        return Math.max(
          0,
          Math.min(outerOpacity, waveOpacity)
        );
      },

      get isOpacityFullyDecayed() {
        return this.opacity < 0.01 &&
          this.radius >= Math.min(this.maxRadius, Ripple.MAX_RADIUS);
      },

      get isRestingAtMaxRadius() {
        return this.opacity >= this.initialOpacity &&
          this.radius >= Math.min(this.maxRadius, Ripple.MAX_RADIUS);
      },

      get isAnimationComplete() {
        return this.mouseUpStart ?
          this.isOpacityFullyDecayed : this.isRestingAtMaxRadius;
      },

      get translationFraction() {
        return Math.min(
          1,
          this.radius / this.containerMetrics.size * 2 / Math.sqrt(2)
        );
      },

      get xNow() {
        if (this.xEnd) {
          return this.xStart + this.translationFraction * (this.xEnd - this.xStart);
        }

        return this.xStart;
      },

      get yNow() {
        if (this.yEnd) {
          return this.yStart + this.translationFraction * (this.yEnd - this.yStart);
        }

        return this.yStart;
      },

      get isMouseDown() {
        return this.mouseDownStart && !this.mouseUpStart;
      },

      resetInteractionState: function() {
        this.maxRadius = 0;
        this.mouseDownStart = 0;
        this.mouseUpStart = 0;

        this.xStart = 0;
        this.yStart = 0;
        this.xEnd = 0;
        this.yEnd = 0;
        this.slideDistance = 0;

        this.containerMetrics = new ElementMetrics(this.element);
      },

      draw: function() {
        var scale;
        var translateString;
        var dx;
        var dy;

        this.wave.style.opacity = this.opacity;

        scale = this.radius / (this.containerMetrics.size / 2);
        dx = this.xNow - (this.containerMetrics.width / 2);
        dy = this.yNow - (this.containerMetrics.height / 2);

        Polymer.Base.translate3d(this.waveContainer, dx + 'px', dy + 'px', 0);

        // 2d transform for safari because of border-radius and overflow:hidden clipping bug.
        // https://bugs.webkit.org/show_bug.cgi?id=98538
        this.wave.style.webkitTransform = 'scale(' + scale + ',' + scale + ')';
        this.wave.style.transform = 'scale3d(' + scale + ',' + scale + ',1)';
      },

      mousedownAction: function(event) {
        this.resetInteractionState();
        this.mouseDownStart = Utility.now();

        this.xStart = event ?
          event.x - this.containerMetrics.boundingRect.left :
          this.containerMetrics.width / 2;
        this.yStart = event ?
          event.y - this.containerMetrics.boundingRect.top :
          this.containerMetrics.height / 2;

        if (this.recenters) {
          this.xEnd = this.containerMetrics.width / 2;
          this.yEnd = this.containerMetrics.height / 2;
          this.slideDistance = Utility.distance(
            this.xStart, this.yStart, this.xEnd, this.yEnd
          );
        }

        this.maxRadius = this.containerMetrics.furthestCornerDistanceFrom(
          this.xStart,
          this.yStart
        );

        this.waveContainer.style.top =
          (this.containerMetrics.height - this.containerMetrics.size) / 2 + 'px';
        this.waveContainer.style.left =
          (this.containerMetrics.width - this.containerMetrics.size) / 2 + 'px';

        this.waveContainer.style.width = this.containerMetrics.size + 'px';
        this.waveContainer.style.height = this.containerMetrics.size + 'px';
      },

      mouseupAction: function(event) {
        if (!this.isMouseDown) {
          return;
        }

        this.mouseUpStart = Utility.now();
      },

      remove: function() {
        Polymer.dom(this.waveContainer.parentNode).removeChild(
          this.waveContainer
        );
      }
    };

    Polymer({
      is: 'paper-ripple',

      properties: {
        /**
         * The initial opacity set on the wave.
         *
         * @attribute initialOpacity
         * @type number
         * @default 0.25
         */
        initialOpacity: {
          type: Number,
          value: 0.25
        },

        /**
         * How fast (opacity per second) the wave fades out.
         *
         * @attribute opacityDecayVelocity
         * @type number
         * @default 0.8
         */
        opacityDecayVelocity: {
          type: Number,
          value: 0.8
        },

        /**
         * If true, ripples will exhibit a gravitational pull towards
         * the center of their container as they fade away.
         *
         * @attribute recenters
         * @type boolean
         * @default false
         */
        recenters: {
          type: Boolean,
          value: false
        },

        /**
         * A list of the visual ripples.
         *
         * @attribute ripples
         * @type Array
         * @default []
         */
        ripples: {
          type: Array,
          value: function() {
            return [];
          }
        }
      },

      configure: function() {
        return {
          ripples: [],
          animating: false,
          boundAnimate: this.animate.bind(this),
          boundMousedownAction: this.mousedownAction.bind(this),
          boundMouseupAction: this.mouseupAction.bind(this)
        };
      },

      get target () {
        return this.host || this.parentNode;
      },

      attached: function() {
        this.target.addEventListener('mousedown', this.boundMousedownAction);
        this.target.addEventListener('mouseup', this.boundMouseupAction);
      },

      detached: function() {
        this.target.removeEventListener('mousedown', this.boundMousedownAction);
        this.target.removeEventListener('mouseup', this.boundMouseupAction);
      },

      /* TODO(cdata): Replace the above attached / detached listeners when
         PolymerGestures equivalent lands in 0.8.
      listeners: {
        mousedown: 'mousedownAction',
        mouseup: 'mouseupAction'
      },
      */

      get shouldKeepAnimating () {
        for (var index = 0; index < this.ripples.length; ++index) {
          if (!this.ripples[index].isAnimationComplete) {
            return true;
          }
        }

        return false;
      },

      simulatedRipple: function() {
        this.mousedownAction();

        // Please see polymer/polymer#1305
        this.async(function() {
          this.mouseupAction();
        }, 1);
      },

      mousedownAction: function(event) {
        var ripple = this.addRipple();

        ripple.mousedownAction(event);

        if (!this.animating) {
          this.animate();
        }
      },

      mouseupAction: function(event) {
        this.ripples.forEach(function(ripple) {
          ripple.mouseupAction(event);
        });

        this.animate();
      },

      onAnimationComplete: function() {
        this.animating = false;
        this.$.background.style.backgroundColor = null;
        this.fire('transitionend');
      },

      addRipple: function() {
        var ripple = new Ripple(this);

        Polymer.dom(this.$.waves).appendChild(ripple.waveContainer);
        this.$.background.style.backgroundColor = ripple.color;
        this.ripples.push(ripple);

        return ripple;
      },

      removeRipple: function(ripple) {
        var rippleIndex = this.ripples.indexOf(ripple);

        if (rippleIndex < 0) {
          return;
        }

        this.ripples.splice(rippleIndex, 1);

        ripple.remove();
      },

      animate: function() {
        var index;
        var ripple;

        this.animating = true;

        for (index = 0; index < this.ripples.length; ++index) {
          ripple = this.ripples[index];

          ripple.draw();

          this.$.background.style.opacity = ripple.outerOpacity;

          if (ripple.isOpacityFullyDecayed && !ripple.isRestingAtMaxRadius) {
            this.removeRipple(ripple);
          }
        }

        if (this.shouldKeepAnimating) {
          window.requestAnimationFrame(this.boundAnimate);
        } else if (this.ripples.length === 0) {
          this.onAnimationComplete();
        }
      }
    });
  })();
;

          ;

  Polymer({
    is: 'letter-card',
    properties: {
      letter: {
        type: String,
        reflectToAttribute: true
      },
      currlang: {
        type: String,
        reflectToAttribute: true
      },
      uid: {
        type: String,
        reflectToAttribute: true
      },
      aacAudio: {
        type: String,
        computed: 'computeAacAudio(letter, currlang)'
      },
      opusAudio: {
        type: String,
        computed: 'computeOpusAudio(letter, currlang)'
      }
    },
    listeners: {
      'click': 'handleClick'
    },
    handleClick: function(e) {
      var audio = this.querySelector("audio");
      audio.play();
    },
    ready: function(e) {
    },
    computeAacAudio: function(letter, mylang) {
      return "/assets/audio/"+ mylang +"/" + letter + ".m4a";
    },
    computeOpusAudio: function(letter, mylang) {
      var audioTag = document.createElement("audio");
      if(!!(audioTag.canPlayType && audioTag.canPlayType('audio/ogg;codecs="opus"').replace(/no/, ''))) {
        return "/assets/audio/"+ mylang +"/" + letter + ".opus";
      } else {
        return '';
      }
    }
  });
;

  Polymer({
    is: 'letter-service',

    properties: {
      letters: {
        type: Array,
        readOnly: true,
        notify: true
      },
      currlang: {
        type: String,
        readOnly: true,
        notify: true
      },
      lobj: {
        type: Object,
        readOnly: true,
        notify: true
      }
    },
    lettersLoaded: function() {
      console.log("loading letters...");
      // Make a copy of the loaded data
      //console.log(ajaxData);
      var ajaxData = this.$.ajax.lastResponse.slice()[0];
      ajaxData.alphabet.forEach(function(entry) {
        entry["currlang"] = ajaxData.lang[0].code;
      });
      this._setLobj(ajaxData);
      //console.log("# letters: " + this.letters.length);
      //console.log(this.letters[1].letter);
      //console.log(this.lobj.alphabet[0].letter);
      //console.log(this.lobj.lang[0].code);
      //console.log(this.currlang);
      //console.log(this.lobj);
      this.fire('new-letters');

    },
    /** 
     * Update the service with the current favorite value.
     * (Two-way data binding updates the favorite value 
     * stored locally.) If this was a real service, this
     * method would do something useful.
     * 
     * @method setFavorite
     * @param uid {Number} Unique ID for post.
     * @param isFavorite {Boolean} True if the user marked this post as a favorite.
     */
    setCard: function(uid, isFavorite) {
      // no service backend, change local data
      var i, len;
      for (i = 0, len=this.posts.length; i<len; i++) {
        if (this.posts[i].uid == uid) {
          //this.posts[i].favorite = isFavorite;
          this.setPathValue('posts.' + i + '.favorite', isFavorite);
          return;
        }
      }
    }
    
  });
  ;

  Polymer({
    is: "letter-list",
    properties: {
      limit: {
        type: Number
      },
      clicked: {
        type: Number,
        notify: true
      }

    },
    bind: {
    },
    created: function() {
      console.log("letter-list created");
    },
    ready: function() {
      console.log("letter-list ready");
    },
    fireTapFunction: function(e) {
      console.log("fire tap function!");
      this.fire("letter-tapped");
    }
  });
