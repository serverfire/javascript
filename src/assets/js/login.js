$(function(){
    $('.form-signin').bind('submit', function()
        {
            var form = this,
            accessKeyId = $('input[name=access-key-id]', form).val(),
            secretAccessKey = $('input[name=secret-access-key]', form).val(),
            rootDirectory = $('input[name=root-directory]', form).val();
            var rds_idx = rootDirectory.indexOf("/");
            if(!rootDirectory || rds_idx === 0)
            {
                alert('Root directory should not be empty');
                return false;
            }
            if(rds_idx >= 0)
                rootDirectory = rootDirectory.substring(0, rds_idx);
            
            AWS.config.update({
                accessKeyId: accessKeyId,
                secretAccessKey: secretAccessKey
            });
            AWS.config.region = 'eu-west-1';
            var s3 = new AWS.S3({ region: 'eu-west-1', maxRetries: 1 }),
            bucket = 'librelio-europe';
            $('button', form).prop('disabled', true);
            s3.listObjects({
                Bucket: bucket,
                Prefix: rootDirectory + "/",
                MaxKeys: 1
            }, function(err, data)
               {
                   if(err)
                   {
                       alert("Couldn't connect to aws s3: " + err);
                   }
                   else if(!data || !data.Contents || 
                           data.Contents.length <= 0)
                   {
                       alert("Invalid directory!");
                   }
                   else
                   {
                       if(!supports_html5_storage())
                           alert("This app does not support your browser");
                       else
                       {
                           var auth_obj = {
                               accessKeyId: accessKeyId,
                               secretAccessKey: secretAccessKey,
                               rootDirectory: rootDirectory
                           };
                           localStorage.setItem("{{ config.localStorageAuthKey }}", JSON.stringify(auth_obj));
                           document.location = "index.html";
                       }
                   }
                   $('button', form).prop('disabled', false);
               });
            return false;
        });
});