
function instanceApi(oboeBus){

   var oboeApi,
       fullyQualifiedNamePattern = /^(node|path):./,
          
       addListener = varArgs(function( eventId, parameters ){
             
            if( oboeApi[eventId] ) {
       
               // for events added as .on(event), if there is a 
               // special .event equivalent, pass through to that 
               apply(parameters, oboeApi[eventId]);                     
            } else {
       
               // we have a standard Node.js EventEmitter 2-argument call.
               // The first parameter is the listener.
               var listener = parameters[0];
       
               if( fullyQualifiedNamePattern.test(eventId) ) {
                
                  // allow fully-qualified node/path listeners 
                  // to be added                                             
                  addPathOrNodeListener(eventId, listener);                  
               } else  {
       
                  // the event has no special handling, pass through 
                  // directly onto the event bus:          
                  oboeBus(eventId).on( listener);
               }
            }
                
            return oboeApi; // chaining
       }),
 
       removeListener = varArgs(function( eventId, parameters ){
             
            if( eventId == 'node' || eventId == 'path' ) {
      
               // allow removal of node and path 
               removePathOrNodeListener(eventId + ':' + parameters[0], parameters[1]);          
            } else {
      
               // we have a standard Node.js EventEmitter 2-argument call.
               // The first parameter is the listener.
               var listener = parameters[0];

               if( fullyQualifiedNamePattern.test(eventId) ) {
               
                  // allow fully-qualified node/path listeners 
                  // to be added                                             
                  removePathOrNodeListener(eventId, listener);                  
               } else  {
      
                  // the event has no special handling, pass through 
                  // directly onto the event bus:          
                  oboeBus(eventId).un( listener);
               }
            }
               
            return oboeApi; // chaining      
       });                               
   
   
   function addPathOrNodeListener( fullyQualifiedName, callback ) {
      
      var safeCallback = protectedCallback(callback);
                              
      oboeBus(fullyQualifiedName).on( function(node, path, ancestors) {
      
         var keep       = true;
             
         oboeApi.forget = function(){
            keep = false;
         };           
         
         safeCallback( node, path, ancestors );         
               
         delete oboeApi.forget;
         
         if(! keep ) {          
            oboeBus(fullyQualifiedName).un( callback);
         }
      }, callback)
   }   
   
   function removePathOrNodeListener( fullyQualifiedName, callback ) {
      oboeBus(fullyQualifiedName).un(callback)
   }
         
   function protectedCallback( callback ) {
      return function() {
         try{      
            callback.apply(oboeApi, arguments);   
         }catch(e)  {
         
            // An error occured during the callback, publish it on the event bus 
            oboeBus(FAIL_EVENT).emit( errorReport(undefined, undefined, e));
         }      
      }   
   }
      
   /**
    * Add several listeners at a time, from a map
    */
   function addListenersMap(eventId, listenerMap) {
   
      for( var pattern in listenerMap ) {
         addPathOrNodeListener(
            eventId + ':' + pattern, 
            listenerMap[pattern]
         );
      }
   }    
      
   /**
    * implementation behind .onPath() and .onNode()
    */       
   function addNodeOrPathListenerApi( eventId, jsonPathOrListenerMap, callback ){
   
      if( isString(jsonPathOrListenerMap) ) {
         addPathOrNodeListener( 
            eventId + ':' + jsonPathOrListenerMap,
            callback
         );
      } else {
         addListenersMap(eventId, jsonPathOrListenerMap);
      }
      
      return oboeApi; // chaining
   }
      
   
   // some interface methods are only filled in after we recieve
   // values and are noops before that:          
   oboeBus(ROOT_FOUND).on( function(root) {
      oboeApi.root = functor(root);   
   });
   
   oboeBus(HTTP_START).on( function(_statusCode, headers) {
   
      oboeApi.header =  function(name) {
                           return name ? headers[name] 
                                       : headers
                                       ;
                        }
   });
         
   /**
    * Construct and return the public API of the Oboe instance to be 
    * returned to the calling application
    */       
   return oboeApi = {
      on             : addListener,
      addListener    : addListener, 
      removeListener : removeListener,
      emit           : oboeBus.emit,                
                
      node           : partialComplete(addNodeOrPathListenerApi, 'node'),
      path           : partialComplete(addNodeOrPathListenerApi, 'path'),
      
      done           : partialComplete(addNodeOrPathListenerApi, 'node', '!'),            
      start          : compose2( oboeBus(HTTP_START).on, protectedCallback ),
      
      // fail doesn't use protectedCallback because 
      // could lead to non-terminating loops
      fail           : oboeBus(FAIL_EVENT).on,
      
      // public api calling abort fires the ABORTING event
      abort          : oboeBus(ABORTING).emit,
      
      // initially return nothing for header and root
      header         : noop,
      root           : noop
   };   
} 
   