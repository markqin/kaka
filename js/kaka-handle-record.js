'use strict';

var fs = require('fs');
var path = require('path');
var async = require('async');
var lodash = require('lodash');
var kakaTime = require('./kaka-timestamp');
var LS = localStorage;

var $handleRecordsList = $('#js_handleRecords .app-records-list');


module.exports = {
	init : init,
	add : add
}


// 加载时初始化
function init() {
	var recordsList;
	if(!LS.handleRecords) {
		recordsList = [];
		setLS(recordsList);
	} else {
		recordsList = reset(getLS());
		lodash.sortBy(recordsList, function(item) {
			return item.id;
		})
		lodash.forEach(recordsList, function(item) {
			addDom(item,false);
		})
		removeDom();
	}
}



// 添加记录
function add(files, opts) {
	var recordItem = {
		files : files,
		opts : opts,
		id : kakaTime(),
		isFixed : false,
		isCurrent : true,
		title : kakaTime()
	}
	
	var recordsList = reset(getLS());
	recordsList.push(recordItem);
	setLS(recordsList);
	addDom(recordItem,true);
}



// 增加操作记录DOM 
function addDom(item,isCurrent) {
	var currentStr = isCurrent ? " current" : "";
	var itemHtml = 
		'<li class="item'+ currentStr +'" data-id="'+item.id+'">' +
			'<div class="title">'+item.title+'</div>' +
			'<div class="actions">' +
				'<button class="btn-remove">remove</button>' +
				'<button class="btn-run">run</button>'  +
				'<button class="btn-info">info</button>' +
				'<button class="btn-fixed">fixed</button>' +
			'</div>' +
		'</li>';

	$handleRecordsList.find('.item').removeClass('current');    
	$handleRecordsList.append(itemHtml);
}


// 删除操作记录DOM
function removeDom() {
	$handleRecordsList.on('click', '.item .btn-remove', function() {
		var $item = $(this).parents('.item');
		var id = $item.attr('data-id');
		var recordsList = getLS();
		lodash.remove(recordsList, function(item){
			return item.id == id;
		});
		setLS(recordsList);
		$item.remove();
	})
}






// 初始化记录
function reset(recordsObj) {
	if(recordsObj.length > 0) {
		lodash.forEach(recordsObj, function(item) {
			item.isCurrent = false;
		})
	}
	return recordsObj;
}


function setLS(obj) {
	LS.setItem('handleRecords', JSON.stringify(obj));
}

function getLS() {
	return JSON.parse(LS.getItem('handleRecords'));
}






