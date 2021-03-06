var express = require('express');
var formidable = require('formidable');
var uuid = require('uuid');
var fs = require('fs');
var path = require('path');
var async = require('async');
var ObjectId = require('bson').ObjectId;
var redisClient = require('../config').redisClient;
var delCompleteArticle = require('../util/delCompleteArticle');

var router = express.Router();

router.delete('/del', function (req, res, next) {
    var userid = req.body.userid;
    var articleid = req.body.articleid;
    if (userid == req.session.user._id) {
        // 在redis中查是否有这篇文章，也就是在当前用户维护的那个链表中查
        // 如果没有查到，则到全局的那个链表中查
        // 如果还没有查到，则去mongodb中查，然后删除
        async.series({
            delArticle: function (done) {
                delCompleteArticle(articleid, function (err) {
                    if (err) {
                        done(err);
                    } else {
                        done(null);
                    }
                });
            },
            // 之所以再维护一个集合，因为文章数量不仅仅是redis中的，而且还有mongodb中的
            decrCurrentPostNum: function (done) {
                if (userid) {
                    redisClient.decr('currentpostnum:userid:' + userid, function (err, result) {
                        if (err) {
                            done({msg: '减少当前用户发布文章数量失败'});
                        }
                        done(null, result);
                    });
                } else {
                    done(null);
                }
            },
            // 判断一下文章是否被删除了
            delFansPost: function (done) {
                redisClient.zrangebyscore('fanspost:userid:' + userid, 0, Date.now(), function (err, result) {
                    if (err) {
                        done({msg: '获取有序集合元素失败'});
                    }
                    if (result) {
                        async.forEachSeries(result, function (item, done) {
                            redisClient.hgetall('article:articleid:' + item, function(err, result) {
                                if (err) {
                                    done({ msg: '查询文章失败' });
                                } else {
                                    // 如果文章不存在，则进行删除
                                    if (!result) {
                                        redisClient.zrem('fanspost:userid:' + userid, item, function (err, result) {
                                            if (err) {
                                                done({msg: '删除失败'});
                                            } else {
                                                done(null);
                                            }
                                        });
                                    } else {
                                        done(null);
                                    }
                                }
                            });
                        }, function (err) {
                            if (err) {
                                done(err);
                            } else {
                                done(null);
                            }
                        });
                    } else {
                        done(null, result);
                    }
                });
            },
            delCurrentPost: function (done) {
                redisClient.lrange('currentpost:userid:' + userid, 0, -1, function (err, result) {
                    if (err) {
                        done({msg: '查询当前用户文章链表失败'});
                    } else {
                        if (result) {
                            async.forEachSeries(result, function (item, done) {
                                redisClient.hgetall('article:articleid:' + item, function(err, result) {
                                    if (err) {
                                        done({ msg: '链表查询文章失败' });
                                    } else {
                                        // 如果文章不存在，则进行删除
                                        if (!result) {
                                            redisClient.lrem('currentpost:userid:' + userid, 1, item, function (err, result) {
                                                if (err) {
                                                    done({msg: '删除失败'});
                                                } else {
                                                    done(null);
                                                }
                                            });
                                        } else {
                                            done(null);
                                        }
                                    }
                                });
                            }, function (err) {
                                if (err) {
                                    done(err);
                                } else {
                                    done(null);
                                }
                            });
                        } else {
                            done(null, result);
                        }
                    }
                });
            }
        }, function (err, results) {
            if (err) {
                return res.status(403).json(err);
            } else {
                return res.status(200).json({msg: '文章删除成功'});
            }
        });
    } else {
        return res.status(401).json({msg: '您不可以删除其他用户的文章'});
    }
});
// 取消文章点赞
router.post('/cancelPraise', function(req, res, next) {
    var praiseArr = [];
    async.series({
        getOriginPraise: function (done) {
        	redisClient.hget('article:articleid:' + req.body.articleid, 'praise', function (err, result) {
        		if (err) {
        			done({msg: '查询赞失败'});
        		}
        		var praise = result;
        		praiseArr = praiseArr.concat(praise.split(','));
        		if (praiseArr.indexOf(req.body.from) != -1) {
        			praiseArr.splice(praiseArr.indexOf(req.body.from), 1);
        		}
        		done(null, result);
        	});
        },
        updatePraise: function (done) {
        	redisClient.hset('article:articleid:' + req.body.articleid, 'praise', praiseArr.toString(), function(err, result) {
                if (err) {
                    done({ msg: '取消赞失败' });
                }
                done(null, result);
            });
        }
    }, function(err, results) {
        if (err) {
            return res.status(403).json(err);
        }
        return res.status(200).json({ msg: '取消赞成功' });
    });
});

// 给文章点赞
router.post('/addPraise', function(req, res, next) {
    // 得到了body中的内容后，articleid和from,
    var praiseArr = [];
    praiseArr.push(req.body.from);
    async.series({
        findPraise: function (done) {
            redisClient.hget('article:articleid:' + req.body.articleid, 'praise', function(err, result) {
                if (err) {
                    done({ msg: '查询赞失败' });
                }
                if (result) {
                    praiseArr = praiseArr.concat(result.split(','));
                }
                done(null, result);
            });
        },
        updatePraise: function(done) {
            redisClient.hset('article:articleid:' + req.body.articleid, 'praise', praiseArr.toString(), function(err, result) {
                if (err) {
                    done({ msg: '点赞失败' });
                }
                done(null, result);
            });
        }
    }, function(err, results) {
        if (err) {
            return res.status(403).json(err);
        }
        return res.status(200).json({ msg: '点赞成功' })
    });
});

// 发表文章
router.post('/post', function(req, res, next) {
    new formidable.IncomingForm().parse(req, function(err, fields, files) {
        var picURL = '';
        var rs = null;
        var pic = null;
        var picName = '';
        if (files.pic) {
            pic = files.pic;
            picName = uuid.v4() + path.extname(pic.name);
            picURL = '/upload/' + picName;
        }

        var articleid = new ObjectId().toString();
        var content = fields.content;
        var createAt = new Date().toString();
        var userid = req.session.user._id;
        var praise = [].toString();
        var commentsid = [].toString();

        async.series({
            insertArticle: function(done) {
                redisClient.hmset('article:articleid:' + articleid, ['content', content, 'picURL', picURL, 'createAt', createAt, 'userid', userid, 'praise', praise, 'commentsid', commentsid], function(err, result) {
                    if (err) {
                        done({ msg: 'redis写入article失败' });
                    }
                    done(null, result);
                });
            },
            findArticle: function(done) {
                // 查询出来的内容就是一个对象，对象的内容都是字符串
                redisClient.hgetall('article:articleid:' + articleid, function(err, result) {
                    if (err) {
                        done({ msg: 'redis中查询文章失败' });
                    }
                    done(null, result);
                });
            },
            writePic: function (done) {
                if (pic) {
                    rs = fs.createReadStream(pic.path);
                    rs.pipe(fs.createWriteStream('./public/upload/' + picName));
                    rs.on('end', function() {
                        done(null, {msg: '上传图片成功'});
                    });
                } else {
                    done(null);
                }
            },
            // 维护一个有序集合，存放20篇文章
            fanspost: function (done) {
                redisClient.zadd('fanspost:userid:' + userid, Date.now(), articleid, function (err, result) {
                    if (err) {
                        done({msg: '保存粉丝拉取用的有序集合失败'});
                    }
                    done(null, result);
                });
            },
            // 判断文章数量是否超过了20，如果超出了，则进行删除
            judgeFansPostNum: function (done) {
                redisClient.zcard('fanspost:userid:' + userid, function (err, result) {
                    if (err) {
                        done({msg: '获取有序集合元素数失败'});
                    }
                    if (result > 18) {
                        redisClient.zremrangebyrank('fanspost:userid:' + userid, 0, 0, function (err, result) {
                            if (err) {
                                done({msg: '有序集合删除失败'});
                            }
                            done(null, result);
                        });
                    } else {
                        done(null, result);
                    }
                });
            },
            // 最后，将文章的id放到自己当前的文章列表中，用于自己查看
            saveCurrentPost: function (done) {
                redisClient.lpush('currentpost:userid:' + userid, articleid, function (err, result) {
                    if (err) {
                        done({msg: '保存文章到当前用户文章链表中失败'});
                    }
                    done(null, result);
                });
            },
            // 最后，将文章的id放到自己当前的文章列表中，用于自己查看
            // 之所以再维护一个集合，因为文章数量不仅仅是redis中的，而且还有mongodb中的
            saveCurrentPostNum: function (done) {
                redisClient.incr('currentpostnum:userid:' + userid, function (err, result) {
                    if (err) {
                        done({msg: '增加当前用户发布文章数量失败'});
                    }
                    done(null, result);
                });
            },
            // 判断当前的文章链表是否超过了40条，如果超出，则导入到全局的文章链表中
            judgeCurrentPostNum: function (done) {
                redisClient.llen('currentpost:userid:' + userid, function (err, result) {
                    if (err) {
                        done({msg: '查询当前用户文章链表数量失败'});;
                    }
                    if (result > 36) {
                        redisClient.rpoplpush('currentpost:userid:' + userid, 'global:article', function (err, result) {
                            if (err) {
                                done({msg: '导出文章失败'});
                            } else {
                                done(null, {msg: '导出文章成功'});
                            }
                        });
                    } else {        
                        done(null, result);
                    }
                });
            }
        }, function(err, results) {
            if (err) {
                return res.status(403).json(err);
            }
            results.findArticle.username = req.session.user.username;
            results.findArticle.avatar = req.session.user.avatar;
            results.findArticle.articleid = articleid;
            results.findArticle.msg = '文章发布成功';
            return res.status(200).json(results.findArticle);
        });
    });
});

module.exports = router;