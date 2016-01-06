(function () {
	var newModelPopup = $('#popup-data-upload');
	
	function viewModel() {
		var btn = $(this);
		var mid = getModelIdFromBtn(btn);
		
		$.ajax('api/selectDataset', {
			method: 'POST',
			contentType: 'application/json',
			data: JSON.stringify({ modelId: mid }),
			success: function (data, status, xhr) {
				redirectToUI();
			},
			error: handleAjaxError
		});
		
		return false;
	}
	
	//========================================================
	// ADDING A NEW MODEL
	//========================================================
	
	function checkConfigureDataset() {
		var isOK = true;
		
		var radio = $('#radio-time');
		var timeVal = radio.find('input:radio').val();
		
		// check if all the values are there
		var hasTimeAttr = timeVal != null && timeVal != '';
		var hasData = $('#input-choose-upload').val() != '';
		var hasName = $('#input-model-name').val() != '';
		var clustAlg = $('#select-clust').val();
		
		if (!hasTimeAttr || !hasData || !hasName)
			isOK = false;
		
		if (clustAlg == null || clustAlg == '')
			isOK = false;
		
		if (clustAlg == 'kmeans') {
			// check K
			var k = $('#input-kmeans-k').val();
			if (!isInt(k)) isOK = false;
		} else if (clustAlg == 'dpmeans') {
			// check lambda and min, max
			var minStates = $('#input-dpmeans-minstates').val();
			var maxStates = $('#input-dpmeans-maxstates').val();
			var lambda = $('#input-dpmeans-lambda').val();
			
			if (minStates != null && minStates != '' && isNaN(minStates)) isOk = false;
			if (maxStates != null && maxStates != '' && isNaN(maxStates)) isOk = false;
			if (isNaN(lambda)) isOk = false;
		}
		
		if (isOK)
			$('#btn-done').removeAttr('disabled');
		else
			$('#btn-done').attr('disabled', 'disabled');
		
		return isOK;
	}

	$('#input-model-name').keyup(checkConfigureDataset);
	
	$('#input-choose-upload').change(function () {
		$('#form-phase2').hide(0);
		$('#form-phase3').hide(0);
		$('#form-phase4').hide(0);
		$('#progress-build-model-wrapper').hide(0);

		var hasData = $('#input-choose-upload').val() != '';
		
		if (!hasData) return;

		console.log('Uploading the file ...');
		
		var form = $('#form-upload');
		var formData = new FormData(form[0]);
		
		var action = form.attr('action');
		var enctype = form.attr('enctype');
		var method = form.attr('method');

		$('#progress-file-upload').css('width', '0%');
		$('#progress-file-upload').html('0%');

		$.ajax(action, {
			contentType: false,
			enctype: enctype,
			data: formData,
			method: method,
			processData: false,
			xhr: function () {
				var myXhr = $.ajaxSettings.xhr();
				if (myXhr.upload) { // Check if upload property exists
	                myXhr.upload.addEventListener('progress', function (event) {
	                	if (event.lengthComputable) {
	                		var prog = (100*(event.loaded / event.total)).toFixed(0);
	                		$('#progress-file-upload').css('width', prog + '%');
							$('#progress-file-upload').html(prog + '%');
	                		console.log('progress: ' + prog);
	                	}
	                }, false); // For handling the progress of the upload
	            }
	            return myXhr;
			},
			success: function (fields, status, xhr) {
				var select = $('#select-attrs');
					
				// clear the attributes
				select.html('');
				for (var i = 0; i < fields.length; i++) {
					var attr = fields[i].name;												
					select.append('<option value="' + attr + '">' + attr + '</option>');
				}
				
				select.bootstrapDualListbox({
					showFilterInputs: true,
					selectedListLabel: 'Selected Attributes',
					nonSelectedListLabel: 'Ignored Attributes'
				});
				select.bootstrapDualListbox('refresh');
			
				select.change(function () {
					$('#form-phase3').hide(0);
					$('#form-phase4').hide(0);
				
					var selectedAttrs = select.val();
					
					if (selectedAttrs == null) return;
					
					// set the time radio selector
					var timeRadio = $('#radio-time');
					timeRadio.html('');	// clear the element
					
					for (var i = 0; i < selectedAttrs.length; i++) {
						var div = $('<div class="radio" />') 
						var label = $('<label />');
						var input = $('<input />');
						
						input.attr('type', 'radio');
						input.attr('name', 'attr-time');
						input.val(selectedAttrs[i]);
						
						label.append(input);
						label.append(selectedAttrs[i]);
						div.append(label);
						timeRadio.append(div);
					}
					
					timeRadio.find('input:radio').change(function () {
						var timeAttr = $(this).val();
						var select = $('#select-controls');
						
						// clear the attributes
						select.html('');
						for (var i = 0; i < selectedAttrs.length; i++) {
							var attr = selectedAttrs[i];
							if (attr != timeAttr)
								select.append('<option value="' + attr + '">' + attr + '</option>');
						}
						
						$('#select-controls').bootstrapDualListbox({
							showFilterInputs: false,
							selectedListLabel: 'Control Atrtibutes',
							nonSelectedListLabel: 'Observation Attributes'
						});
						$('#select-controls').bootstrapDualListbox('refresh');
						
						// show the attribute selection
						$('#form-phase4').show();
					});
					
					timeRadio.find('input:radio').change(checkConfigureDataset);
					
					$('#form-phase3').show(0);
				});
				
				$('#form-phase2').show();
			},
			error: function (xhr, status) {
				alert('Failed to upload file: ' + status + '!');
			}
		});
	});
	
	function pingProgress(isRealTime) {
		console.log('Pinging for model progress ...');
		
		$.ajax('api/pingProgress', {
			method: 'GET',
			contentType: 'application/json',
			success: function (data, status, xhr) {
				console.log('Gor ping result!');
				
				if (xhr.status == 204) {	// no content
					pingProgress(isRealTime);
					return;
				}
				
				if (data.error != null) {
					alert('Error while building model: ' + data.error);
				} else {
					$('#progress-build-model').css('width', data.progress + '%');
					$('#progress-build-model').html(data.message);
					
					if (!data.isFinished) {
						pingProgress(isRealTime);
					} else {	// finished
						console.log('Finished building the model!');
					
						var mid = data.mid;
						
						// fetch the new model
						$.ajax('api/modelDetails', {
							dataType: 'json',
							method: 'GET',
							data: { modelId: mid },
							success: function (data) {
								var table = isRealTime ? $('#table-models-active') : $('#table-models-offline');
								var tbody = table.find('tbody');
								
								var tr = $('<tr />');
								tr.attr('id', (isRealTime ? 'active-' : 'offline-') + data.mid);
								tr.addClass('ui-sortable-handle');
								
								var nameTd = $('<td />');
								var dateTd = $('<td />');
								var buttonsTd = $('<td />');
								
								nameTd.addClass('td-model-name');
								nameTd.html(data.name);
								
								dateTd.addClass('td-model-date');
								dateTd.html(formatDate(new Date(data.creationDate)));
								
								buttonsTd.addClass('td-btns');
															
								tr.append(nameTd);
								tr.append(dateTd);
								tr.append(buttonsTd);
								tbody.append(tr);
								
								// initialize the buttons
								var buttonSpan = $('<span class="pull-right span-btns" />');
								
								var btnView = $('<button class="btn btn-info btn-xs btn-view" aria-label="Left Align"><span class="glyphicon glyphicon-eye-open"></span> View</button>');
								btnView.click(viewModel);
								
								if (isRealTime) {
									var deactivateBtn = $('<button class="btn btn-danger btn-xs btn-deactivate" aria-label="Left Align"><span class="glyphicon glyphicon-off"></span> Deactivate</button>');
									deactivateBtn.click(deactivate);
									buttonSpan.append(deactivateBtn);
								} else {
									var shareBtn = $('<button class="btn btn-default btn-xs btn-share" aria-label="Left Align"><span class="glyphicon glyphicon-globe"></span> Share</button>');
									shareBtn.click(share);
									buttonSpan.append(shareBtn);
								}
								
								buttonSpan.append(btnView);
								buttonsTd.append(buttonSpan);
								
								setTimeout(function () {
									$('#div-model-progress').addClass('hidden');
								}, 5000);
							},
							error: handleAjaxError
						});
					}
				}
			},
			error: function (xhr, status, e) {
				handleAjaxError(xhr, status, e);
				$('#div-model-progress').addClass('hidden');
			}
		});
	}
	
	$('#btn-done').click(function () {
		var btn = $(this);
		
		if (!checkConfigureDataset()) return;
		
		$('#progress-build-model-wrapper').show(0);
	
		var attrs = $('#select-attrs').val();
		var controlAttrs = $('#select-controls').val();
		var isRealTime = $('#check-realtime').is(':checked');
		var name = $('#input-model-name').val();
		var clustAlg = $('#select-clust').val();
		var hierarchyType = $('#select-hierarchy').val();
		
		var data = {
			username: $('#input-email').val(),
			time: $('#radio-time').find('input:radio').val(),
			timeUnit: $('#select-tu').val(),
			attrs: attrs,
			controlAttrs: controlAttrs != null ? controlAttrs : [],
			hierarchyType: hierarchyType,
			isRealTime: isRealTime,
			name: name
		}
		
		if (clustAlg == 'kmeans') {
			data.clust = {
				type: clustAlg,
				k: parseInt($('#input-kmeans-k').val())
			}
		} else if (clustAlg == 'dpmeans') {
			data.clust = {
				type: clustAlg,
				lambda: parseFloat($('#input-dpmeans-lambda').val())
			}
			
			var minStates = $('#input-dpmeans-minstates').val();
			var maxStates = $('#input-dpmeans-maxstates').val();
			
			if (minStates != null && minStates != '')
				data.clust.minStates = minStates;
			if (maxStates != null && maxStates != '')
				data.clust.maxStates = maxStates;
		}
		
		$.ajax('api/buildModel', {
			method: 'POST',
			contentType: 'application/json',
			data: JSON.stringify(data),
			timeout: 1000*60*60*24,	// 1 day
			success: function (data) {
				newModelPopup.modal('hide');
				$('#div-model-progress').removeClass('hidden');
				pingProgress(isRealTime);
			},
			error: handleAjaxError
		});
		
		btn.attr('disabled', 'disabled');
	});
	
	//========================================================
	// TABLES
	//========================================================	
	
	function getContainerFromTable(table) {
		return table.parent().parent().parent().parent().parent().parent();
	}
	
	function getModelIdFromTr(tr) {
		return tr.attr('id').split('-')[1];
	}
	
	function getTrFromBtn(btn) {
		return btn.parent().parent().parent();
	}
	
	function getModelNameFromTr(tr) {
		return tr.find('.td-model-name').html();
	}
	
	function getModelIdFromBtn(btn) {
		var tr = getTrFromBtn(btn);
		return getModelIdFromTr(tr);
	}
	
	function fetchModelDetails(mid) {
		$.ajax('api/modelDetails', {
			dataType: 'json',
			method: 'GET',
			data: { modelId: mid },
			success: function (data) {
				$('#div-model-name').html(data.name);
				$('#span-creator').html(data.creator);
				$('#span-creation-date').html(formatDateTime(new Date(data.creationDate)));
				$('#span-dataset').html(data.dataset);
				
				if (data.isOnline) {
					$('#span-online-offline').addClass('green');
					$('#span-online-offline').html('online');
					
					if (data.isActive) {
						$('#span-model-active-public').removeClass('red');
						$('#span-model-active-public').addClass('green');
						$('#span-model-active-public').html('active');
					} else {
						$('#span-model-active-public').removeClass('green');
						$('#span-model-active-public').addClass('red');
						$('#span-model-active-public').html('inactive');
					}
				} else {
					$('#span-online-offline').removeClass('green');
					$('#span-online-offline').html('offline');
					
					$('#span-model-active-public').removeClass('red');
					$('#span-model-active-public').removeClass('green');
					
					if (data.isPublic) {
						$('#span-model-active-public').html('public');
					} else {
						$('#span-model-active-public').html('private');
					}
				}
				
				$('#div-model-details').removeClass('hidden');
			},
			error: handleAjaxError
		});
	}
	
	$('#table-models-active tbody,#table-models-inactive tbody,#table-models-offline tbody,#table-models-public tbody').sortable({
		helper: function(e, tr) {
   			var $originals = tr.children();
   			var $helper = tr.clone();
   			$helper.children().each(function(index) {
   				$(this).width($originals.eq(index).width())
			});         
   			return $helper;     
		}
	});
	
	$('#table-models-active tbody tr,#table-models-inactive tbody tr,#table-models-offline tbody tr,#table-models-public tbody tr').click(function () {
		$('#table-models-active tbody tr,#table-models-inactive tbody tr,#table-models-offline tbody tr,#table-models-public tbody tr').removeClass('success');
		
		var tr = $(this);
		tr.addClass('success');
		
		var mid = getModelIdFromTr(tr);
		fetchModelDetails(mid);
	});
	
	
	
	//========================================================
	// BUTTONS ON THE DASHBOARD
	//========================================================	
	
	$('#btn-add-online').click(function () {
		$('#check-realtime').prop('checked', true);
		newModelPopup.modal('show');
	});
	
	$('#btn-add-offline').click(function () {
		$('#check-realtime').prop('checked', false);
		newModelPopup.modal('show');
	});
	
	$('.btn-view').click(viewModel);
	
	function activate() {
		var btn = $(this);
		var tr = getTrFromBtn(btn);
		var mid = getModelIdFromTr(tr);
		var name = getModelNameFromTr(tr);
		
		promptConfirm('Activate Model', 'Are you sure you wish to activate model ' + name + '?', function () {
			$.ajax('api/activateModel', {
				method: 'POST',
				contentType: 'application/json',
				data: JSON.stringify({ modelId: mid, activate: true }),
				success: function (data, status, xhr) {
					tr.parent().remove(tr.attr('id'));
					$('#table-models-active').find('tbody').append(tr);
					
					tr.attr('id', 'active-' + mid);
					var newBtn = $('<button class="btn btn-danger btn-xs btn-deactivate" aria-label="Left Align"><span class="glyphicon glyphicon-off"></span> Deactivate</button>');
					
					tr.find('.btn-activate').remove();
					tr.find('.span-btns').prepend(newBtn)
					
					newBtn.click(deactivate);
					
					if (tr.hasClass('success'))
						fetchModelDetails(mid);
				},
				error: handleAjaxError
			});
		});
		
		return false;
	}
	
	function deactivate() {
		var btn = $(this);
		var tr = getTrFromBtn(btn);
		var mid = getModelIdFromTr(tr);
		var name = getModelNameFromTr(tr);
		
		promptConfirm('Deactivate Model', 'Are you sure you wish to deactivate model ' + name + '?', function () {
			$.ajax('api/activateModel', {
				method: 'POST',
				contentType: 'application/json',
				data: JSON.stringify({ modelId: mid, activate: false }),
				success: function (data, status, xhr) {
					tr.parent().remove(tr.attr('id'));
					$('#table-models-inactive').find('tbody').append(tr);
					
					var newBtn = $('<button class="btn btn-success btn-xs btn-activate" aria-label="Left Align"><span class="glyphicon glyphicon-off"></span> Activate</button>');
					
					tr.find('.btn-deactivate').remove();
					tr.find('.span-btns').prepend(newBtn);
					
					newBtn.click(activate);
					
					if (tr.hasClass('success'))
						fetchModelDetails(mid);
				},
				error: handleAjaxError
			});
		});
		
		return false;
	}
	
	function share() {
		var btn = $(this);
		var tr = getTrFromBtn(btn);
		var mid = getModelIdFromTr(tr);
		var name = getModelNameFromTr(tr);
		
		promptConfirm('Share Model', 'Are you sure you wish to share model ' + name + '?', function () {
			$.ajax('api/shareModel', {
				method: 'POST',
				contentType: 'application/json',
				data: JSON.stringify({ modelId: mid, share: true }),
				success: function (data, status, xhr) {
					tr.parent().remove(tr.attr('id'));
					$('#table-models-public').find('tbody').append(tr);
					
					var newBtn = $('<button class="btn btn-warning btn-xs btn-unshare" aria-label="Left Align"><span class="glyphicon glyphicon-globe"></span> Unshare</button>');
					
					tr.find('.btn-share').remove();
					tr.find('.span-btns').prepend(newBtn);
					
					newBtn.click(unshare);
					
					if (tr.hasClass('success'))
						fetchModelDetails(mid);
				},
				error: handleAjaxError
			});
		});
		
		return false;
	}
	
	function unshare() {
		var btn = $(this);
		var tr = getTrFromBtn(btn);
		var mid = getModelIdFromTr(tr);
		var name = getModelNameFromTr(tr);
		
		promptConfirm('Unshare Model', 'Are you sure you wish to unshare model ' + name + '?', function () {
			$.ajax('api/shareModel', {
				method: 'POST',
				contentType: 'application/json',
				data: JSON.stringify({ modelId: mid, share: false }),
				success: function (data, status, xhr) {
					tr.parent().remove(tr.attr('id'));
					$('#table-models-offline').find('tbody').append(tr);
					
					var newBtn = $('<button class="btn btn-default btn-xs btn-share" aria-label="Left Align"><span class="glyphicon glyphicon-globe"></span> Share</button>');
				
					tr.find('.btn-unshare').remove();
					tr.find('.span-btns').prepend(newBtn);
					
					newBtn.click(share);
					
					if (tr.hasClass('success'))
						fetchModelDetails(mid);
				},
				error: handleAjaxError
			});
		});
		
		return false;
	}
	
	// table buttons
	$('.btn-activate').click(activate);
	$('.btn-deactivate').click(deactivate);
	$('.btn-share').click(share);
	$('.btn-unshare').click(unshare);
	
	//========================================================
	// INITIALIZE NAVIGATION
	//========================================================	
	
	$('.nav-pills a').click(function () {
		$('#div-model-details').addClass('hidden');
	});
	
	$('.nav-pills a')[0].click();
})();