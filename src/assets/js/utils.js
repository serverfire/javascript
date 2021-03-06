(function(root){

// lists directories within another directory
root.s3ListDirectories = function(awsS3, opts, cb)
{
    opts = $.extend(true, {}, opts);
    opts.Delimiter = '/';
    var prefix = opts.Prefix || '/';
    opts.Prefix = prefix + (prefix[prefix.length - 1] != '/' ? '/' : '')
    prefix = opts.Prefix;
    s3ListAllObjects(awsS3, opts, function(err, res)
      {
          var dirs;
          if(!err && res.CommonPrefixes)
          {
              var prefixes = res.CommonPrefixes,
              pttrn = /[^\/]+/;
              dirs = [];
              for(var i = 0, l = prefixes.length; i < l; ++i)
              {
                  var m = pttrn.exec(prefixes[i].Prefix.substr(prefix.length));
                  if(m && m[0])
                      dirs.push(m[0]);
              }
          }
          cb.call(this, err, dirs);
      });
}
root.s3ListAllObjects = function(s3, opts, cb, marker)
{
    opts_cpy = $.extend(true, {}, opts);
    opts_cpy.Marker = marker || '';
    s3.listObjects(opts_cpy, function(err, res)
       {
           if(err)
               return cb && cb(err);
           var r = res.Contents,
           nextMarker = res.NextMarker ? res.NextMarker : 
               (r.length > 0 ? r[r.length - 1].Key : '');
           if(res.IsTruncated && nextMarker)
           {
               s3ListAllObjects(s3, opts, function(err, res2)
                   {
                       if(err)
                           return cb && cb(err);
                       res.Contents = res.Contents.concat(res2.Contents);
                       res.CommonPrefixes = res.CommonPrefixes.concat(res2.CommonPrefixes);
                       res.IsTruncated = false;
                       cb(undefined, res);
                   }, nextMarker);
           }
           else
               cb(undefined, res);
       });
}


var illegal_class_chars_pttrn = /#.\(\)/g;
root.encodeStringToClassName = function(s)
{
    return s.replace(illegal_class_chars_pttrn, '_');
}

// this method makes eval_opts_prop
function _eval_opts_prop_maker(call_this, call_args)
{
    return function(p)
    {
        return typeof p == 'function' ? p.apply(call_this, call_args) : p;
    }
}
function S3LoadUpload($upload, opts)
{
    var input = $upload.find('input[type=file]')[0],
    eval_opts_prop = _eval_opts_prop_maker(input, [$upload, opts])
    $inp = $upload.find('input[type=file]');
    switch(opts.type)
    {
    case 'Image':
        var url = opts.s3.getSignedUrl('getObject', {
            Bucket: opts.Bucket,
            Key: opts.Key ? eval_opts_prop(opts.Key) : 
                eval_opts_prop(opts.Prefix) + $inp.attr('name'),
            Expires: opts.signExpires ? eval_opts_prop(opts.signExpires) : 900
        });
        var $img = $('<img/>');
        $upload.removeClass('fileinput-new')
            .toggleClass('fileinput-exists', true);
        $img.prop('src', url)
            .bind('error', function()
              {
                  $upload.toggleClass('fileinput-new', true)
                      .removeClass('fileinput-exists');
                  $img.remove();
              });
        $upload.find('.fileinput-preview').empty().append($img);
        break;
    default:
        s3ObjectExists(opts.s3, {
            Bucket: opts.Bucket,
            Key: opts.Key ? eval_opts_prop(opts.Key) : 
                eval_opts_prop(opts.Prefix) + $inp.attr('name')
        }, function(err, file_exists)
           {
               file_exists = !!file_exists;
               $upload.toggleClass('fileinput-new', !file_exists)
                   .toggleClass('fileinput-exists', file_exists);
           });
        break;
    }
}
root.s3UploadInit = function($upload, opts)
{
    var input = $upload.find('input[type=file]')[0],
    eval_opts_prop = _eval_opts_prop_maker(input, [$upload, opts]),
    isUploading;
    if(typeof opts.loadnow === 'undefined' || opts.loadnow)
        S3LoadUpload($upload, opts);
    $upload.find('input[type=file]').bind('change', function()
      {
          function setPBar(percent)
          {
              pbar_wrp.html('<div class="progress">'+
                    '<div class="progress-bar" role="progressbar" aria-valuenow="'+percent+'" aria-valuemin="0" aria-valuemax="100" style="width: '+percent+'%;">'+
                      (percent ? percent+'%' : '')+
                    '</div>'+
                  '</div>');
          }
          function operationEnd()
          {
              pbar_wrp.remove();
              $new_btn.html(new_v);
              $change_btn.html(change_v);
              $this.prop('disabled', false);
              isUploading = false;
              if(rmHandler)
                  $upload.find('.fileinput-remove').unbind('click', rmHandler);
          }
          var $this = $(this),
          file = this.files ? this.files[0] : null;
          if(file)
          {
              $this.prop('disabled', true);
              var $new_btn = $upload.find('.fileinput-new'),
              $change_btn = $upload.find('.fileinput-change'),
              image_name = $this.attr('name'),
              new_v = $new_btn.html(),
              change_v = $change_btn.html(),
              pbar_wrp = $('<div/>').appendTo($upload)
                  .css('marginTop', 16),
              rmHandler;
              
              isUploading = true;
              $new_btn.text('Uploading...');
              $change_btn.text('Uploading...');
              setPBar(0);
              
              var request = opts.s3.putObject({
                  Bucket: opts.Bucket,
                  Key: opts.Key ? eval_opts_prop(opts.Key) : 
                      eval_opts_prop(opts.Prefix) + image_name,
                  Body: file,
                  ContentType: file.type
              }, function(err, res)
                 {
                     operationEnd();
                     if(err)
                     {
                         typeof opts.onerror == 'function' && opts.onerror(err);
                         return;
                     }
                     if(typeof opts.onUploadSuccess == 'function')
                         opts.onUploadSuccess();
                         
                 });
              $upload.find('.fileinput-remove').bind('click', 
                                                     rmHandler = function()
                 {
                     operationEnd();
                     if(httpRequest.abort)
                         httpRequest.abort();
                 });
              var httpRequest = request.httpRequest.stream;
              if(httpRequest.upload)
                  $(httpRequest.upload).on('progress', function(ev)
                      {
                          ev = ev.originalEvent;
                          var complete = ev.loaded / ev.total;
                          setPBar(Math.floor(complete * 100))
                      });
          }
      });
    $upload.find('.fileinput-remove').click('click', function()
      {
          var $this = $(this);
          if(isUploading || $this.data('inProgress'))
              return;
          $upload.find('input[type=file]').prop('disabled', true);
          var $new_btn = $upload.find('.fileinput-new'),
          $preview = $upload.find('.fileinput-preview'),
          new_v = $new_btn.html(),
          preview_v = $preview.html();
          
          $new_btn.text('Removing...');
          opts.s3.deleteObject({
              Bucket: opts.Bucket,
              Key: opts.Key ? eval_opts_prop(opts.Key) : 
                  eval_opts_prop(opts.Prefix) + image_name
          }, function(err)
             {
                 $upload.find('input[type=file]').prop('disabled', false);
                 $new_btn.html(new_v);
                 if(err)
                 {
                     $preview.html(preview_v);
                     $upload.toggleClass('fileinput-new', false)
                         .toggleClass('fileinput-exists', true);
                     typeof opts.onerror == 'function' && opts.onerror(err);
                     return;
                 }
                 
             });
      });
    return {
        reload: function()
        {
            S3LoadUpload($upload, opts);
        }
    };
}

root.awsExpireReverse = function(s)
{
    var now = new Date();
    now = Math.floor(now.getTime() / 1000) - 
        now.getTimezoneOffset() * 60;
    s = s * 3600;
    return s - (now % s);
}

// gets input elements of forms and puts them and their values in a object
// excluding files
root.getObjectOfForm = function(el)
{
    var ret = {},
    $el = $(el);
    $el.find('input[type=text], textarea')
        .each(function()
          {
              var $this = $(this);
              ret[$this.attr('name')] = $this.data('value') ||
                  $this.val() || '';
          });
    $el.find('input[type=radio]').each(function()
          {
              if(this.checked)
                  ret[this.name] = this.value;
          });
    return ret;
}

root.s3ObjectExists = function(s3, opts, cb)
{
    opts = $.extend(true, {}, opts);
    var isKey = opts.Key && !opts.Prefix;
    opts.Prefix = opts.Key || opts.Prefix;
    delete opts.Key;
    if(!isKey)
        opts.MaxKeys = 1;
    s3.listObjects(opts, function(err, data)
        {
            if(err)
                return cb && cb(err);
            var exists;
            if(isKey)
            {
                var Contents = data.Contents;
                for(var i = 0, l = Contents.length; i < l; ++i)
                {
                    if(Contents[i].Key == opts.Prefix)
                    {
                        exists = true;
                        break;
                    }
                }
            }
            else
                exists = data && data.Contents &&
                               data.Contents.length > 0;
            cb && cb(undefined, exists);
        });
}

})(window);
