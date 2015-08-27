# Makefile for web development with:
# 1. ES6 / Babel compiler
# 2. Bundler (Webpack or Browserify)
# 3. Static Web Server

SRC = $(wildcard src/*.js) $(wildcard src/**/*.js)
LIB = $(SRC:src/%.js=lib/%.js)

build: $(LIB)

lib/%.js: src/%.js
	mkdir -p $(@D)
	babel -p --stage 0 -m umd $< -o $@

clean:
	rm -rf lib;
